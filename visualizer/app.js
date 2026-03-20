// XIAO nRF52840 Sense IMU Visualizer
// Web Serial API を使用してシリアルデータを受信し、3Dビジュアライゼーションとグラフを表示

// グローバル変数
let port;
let reader;
let isConnected = false;
let connectionMode = 'serial'; // 'serial' or 'bluetooth'

// BLE同時接続（最大）
const MAX_BLE_DEVICES = 10;
const BLE_COLORS = [
    0xff3b3b, 0x4ecdc4, 0x4b6cf0, 0xff6b35, 0x7b2cbf,
    0x20c997, 0xfeca57, 0x54a0ff, 0x01a3a4, 0x5f27cd
];

// Nordic UART Service UUID（データ受信チャネル）
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
// Web Bluetooth の requestDevice() は「広告パケットに出ている情報」に依存するため
// 名前フィルタは複数の可能性を OR で許容する
const BLE_NAME_PREFIXES = ['XIAO_IMU', 'XIAO_MG24_IMU', 'XIAO'];

async function requestOneBleDevice() {
    // Web Bluetooth: requestDevice() は必ずユーザー操作直後に呼ぶ必要がある
    // その前提で、名前フィルタ優先→見つからなければサービスUUIDフィルタへフォールバック
    try {
        const filters = [
            ...BLE_NAME_PREFIXES.map(p => ({ namePrefix: p })),
            { services: [UART_SERVICE_UUID] }
        ];
        return await navigator.bluetooth.requestDevice({
            filters,
            optionalServices: [UART_SERVICE_UUID]
        });
    } catch (e) {
        if (e && e.name === 'NotFoundError') {
            // ここまで失敗するなら、フィルタを更に緩めた探索を試す
            return await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'XIAO' }],
                optionalServices: [UART_SERVICE_UUID]
            });
        }
        throw e;
    }
}

// 3D/グラフ
let scene, camera, renderer, axesHelper;
let accelChart, gyroChart;

// UI表示用（選択中デバイスのみ）
let packetCount = 0;
let sampleRate = 0;
let activeDeviceId = 'serial';

// 軌跡トレース
let trajectoryEnabled = true;
const POS_SCALE = 0.2; // 位置座標の見やすさ調整（m -> scene）
const TRAJ_MAX_POINTS = 2000;

// 設定（カルマン / ZUPT 用）
let GYRO_THRESHOLD = 0.5; // °/s（デッドゾーン兼、静止判定の基準）
let ENABLE_DRIFT_COMPENSATION = true; // ドリフト補正（Yawバイアス推定 + ZUPT）
let MA_WINDOW_SIZE = 20; // 静止判定の移動平均ウィンドウ
let DRIFT_CHANGE_THRESHOLD = 0.3; // 静止判定の変化閾値（°/s）
let LINACC_THRESHOLD = 0.20; // m/s^2（重力除去後の線形加速度が小さい時に静止とみなす）
let ZUPT_POS_STREAK = 10; // 静止判定が連続して成立したサンプル数

// グラフ用（選択中デバイスだけ表示）
const MAX_DATA_POINTS = 50;
const posData = { x: [], y: [], z: [] };      // 相対位置（m）
const velData = { x: [], y: [], z: [] };      // 相対速度（m/s）: 表示用
const angleData = { roll: [], pitch: [], yaw: [] }; // 相対向き（deg）
const timeLabels = [];

// デバイス状態（Serial/BLE共通）
// key: deviceId（serial='serial', BLEは device.id）
const deviceStates = new Map();

// 現在のBLE接続一覧（for描画更新/切断）
const bleDevices = [];

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    initCharts();
    setupEventListeners();
    checkWebSerialSupport();
});

// Web Serial API サポートチェック
function checkWebSerialSupport() {
    if (!('serial' in navigator)) {
        updateStatus('error', 'Web Serial API非対応');
        alert('このブラウザはWeb Serial APIをサポートしていません。Chrome または Edge をご使用ください。');
        document.getElementById('connectBtn').disabled = true;
    }
}

// イベントリスナー設定
function setupEventListeners() {
    document.getElementById('connectBtn').addEventListener('click', toggleConnection);

    // 接続モード選択
    const modeRadios = document.querySelectorAll('input[name="connectionMode"]');
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            connectionMode = e.target.value;
            updateConnectionButtonText();
        });
    });

    // リセットボタンのイベントリスナー
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetOrientation);
    }

    const addBleBtn = document.getElementById('addBleBtn');
    if (addBleBtn) {
        addBleBtn.addEventListener('click', connectAdditionalBluetoothDevice);
    }

    // ドリフト補正トグル
    const driftToggle = document.getElementById('driftCompensation');
    if (driftToggle) {
        driftToggle.addEventListener('change', (e) => {
            ENABLE_DRIFT_COMPENSATION = e.target.checked;
            console.log('ドリフト補正:', ENABLE_DRIFT_COMPENSATION ? 'ON' : 'OFF');
        });
    }

    // 軌跡トレースON/OFF
    const trajToggle = document.getElementById('trajectoryEnabled');
    if (trajToggle) {
        trajectoryEnabled = trajToggle.checked;
        trajToggle.addEventListener('change', (e) => {
            trajectoryEnabled = e.target.checked;
            syncTrajectoryVisibility();
        });
    }

    // 表示デバイス切り替え
    const deviceSelect = document.getElementById('deviceSelect');
    if (deviceSelect) {
        deviceSelect.addEventListener('change', (e) => {
            setActiveDevice(e.target.value);
        });
    }

    // デッドゾーン閾値スライダー
    const thresholdSlider = document.getElementById('gyroThreshold');
    const thresholdValue = document.getElementById('thresholdValue');
    if (thresholdSlider && thresholdValue) {
        thresholdSlider.addEventListener('input', (e) => {
            GYRO_THRESHOLD = parseFloat(e.target.value);
            thresholdValue.textContent = GYRO_THRESHOLD.toFixed(2);
        });
    }

    // 移動平均ウィンドウサイズスライダー
    const windowSlider = document.getElementById('maWindowSize');
    const windowValue = document.getElementById('windowValue');
    if (windowSlider && windowValue) {
        windowSlider.addEventListener('input', (e) => {
            MA_WINDOW_SIZE = parseInt(e.target.value);
            windowValue.textContent = MA_WINDOW_SIZE;
        });
    }

    // 変化閾値スライダー
    const changeSlider = document.getElementById('changeThreshold');
    const changeValue = document.getElementById('changeValue');
    if (changeSlider && changeValue) {
        changeSlider.addEventListener('input', (e) => {
            DRIFT_CHANGE_THRESHOLD = parseFloat(e.target.value);
            changeValue.textContent = DRIFT_CHANGE_THRESHOLD.toFixed(2);
        });
    }
}

const DEG2RAD = Math.PI / 180;

function wrapRad(a) {
    // [-pi, pi] に丸め
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
}

function average(arr) {
    if (!arr.length) return 0;
    let s = 0;
    for (const v of arr) s += v;
    return s / arr.length;
}

function createAngleKalman({ qAngle = 0.001, qBias = 0.003, rMeasure = 0.03 } = {}) {
    // 角度とバイアスの2状態（1軸用）
    let angle = 0; // rad
    let bias = 0;  // rad/s
    let P00 = 0, P01 = 0, P10 = 0, P11 = 0;

    return {
        get angle() { return angle; },
        get bias() { return bias; },
        setInitial(measuredAngleRad) {
            angle = measuredAngleRad;
            bias = 0;
            P00 = 1; P01 = 0;
            P10 = 0; P11 = 1;
        },
        update(measuredAngleRad, gyroRateRad, dt) {
            // Predict
            const rate = gyroRateRad - bias;
            angle += rate * dt;

            P00 += dt * (dt * P11 - P01 - P10 + qAngle);
            P01 -= dt * P11;
            P10 -= dt * P11;
            P11 += qBias * dt;

            // Update
            const S = P00 + rMeasure;
            const K0 = P00 / S;
            const K1 = P10 / S;
            const y = measuredAngleRad - angle;

            angle += K0 * y;
            bias += K1 * y;

            const P00_old = P00;
            const P01_old = P01;
            P00 -= K0 * P00_old;
            P01 -= K0 * P01_old;
            P10 -= K1 * P00_old;
            P11 -= K1 * P01_old;
        }
    };
}

function createPosKalmanAxis({ qAccel = 1.0, rVel = 0.05 } = {}) {
    // 状態: [p, v] （1軸用）
    let p = 0; // m
    let v = 0; // m/s
    // 共分散
    let P00 = 1, P01 = 0, P10 = 0, P11 = 1;

    return {
        get p() { return p; },
        get v() { return v; },
        reset() {
            p = 0; v = 0;
            P00 = 1; P01 = 0;
            P10 = 0; P11 = 1;
        },
        forceVelocity(vNew) {
            v = vNew;
        },
        predict(acc, dt) {
            // State prediction with input acc
            p = p + v * dt + 0.5 * acc * dt * dt;
            v = v + acc * dt;

            // F = [[1, dt],[0,1]]
            const newP00 = P00 + dt * (P10 + P01) + dt * dt * P11;
            const newP01 = P01 + dt * P11;
            const newP10 = P10 + dt * P11;
            const newP11 = P11;

            // Process noise for constant-acceleration model
            const q00 = qAccel * Math.pow(dt, 4) / 4;
            const q01 = qAccel * Math.pow(dt, 3) / 2;
            const q11 = qAccel * Math.pow(dt, 2);

            P00 = newP00 + q00;
            P01 = newP01 + q01;
            P10 = newP10 + q01;
            P11 = newP11 + q11;
        },
        updateVelocity(z = 0) {
            // Observation: v == z
            const S = P11 + rVel;
            const K0 = P01 / S; // since H=[0,1]
            const K1 = P11 / S;
            const y = z - v;

            p = p + K0 * y;
            v = v + K1 * y;

            // P = (I - K H) P
            const P00_old = P00;
            const P01_old = P01;
            const P10_old = P10;
            const P11_old = P11;

            P00 = P00_old - K0 * P10_old;
            P01 = P01_old - K0 * P11_old;
            P10 = P10_old - K1 * P10_old;
            P11 = P11_old - K1 * P11_old;
        }
    };
}

function createDeviceState({ deviceId, displayName, color, kind, cubeStartIndex }) {
    const rollKF = createAngleKalman();
    const pitchKF = createAngleKalman();

    const posKF = {
        x: createPosKalmanAxis(),
        y: createPosKalmanAxis(),
        z: createPosKalmanAxis()
    };

    // 3D
    const geometry = new THREE.BoxGeometry(1, 0.25, 0.6);
    const material = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        shininess: 80
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.material = material;

    // ワイヤーフレーム
    const edges = new THREE.EdgesGeometry(geometry);
    const wireframe = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 })
    );
    cube.add(wireframe);

    // 初期位置は原点付近にまとめる（オーバーラップ回避のため）
    const offset = 0.05 * cubeStartIndex;
    cube.position.set(offset, 0, 0);
    scene.add(cube);

    // 軌跡ライン
    const startPoint = new THREE.Vector3(0, 0, 0);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([startPoint]);
    const lineMaterial = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.visible = trajectoryEnabled;
    scene.add(line);

    // 表示/状態
    const state = {
        deviceId,
        displayName,
        kind,
        color,

        cube,
        line,
        trajPoints: [],

        originSet: false,
        roll0: 0,
        pitch0: 0,
        yaw0: 0,

        // 現在の角度/バイアス
        yaw: 0,       // rad（絶対）
        yawBias: 0,  // rad/s

        rollKF,
        pitchKF,
        posKF,

        // 重力成分（加速度のローパス推定）
        gravityBody: new THREE.Vector3(0, 0, 9.81),
        gravityLpTauSec: 0.5,

        lastUpdateMs: 0,
        lastPacketTsMs: 0,
        packetCount: 0,
        lastSampleRateHz: 0,

        // 静止判定
        gyroMagHistory: [],
        stationaryPosCount: 0,

        // BLEテキスト混在用
        textBuffer: '',

        history: {
            timeLabels: [],
            posData: { x: [], y: [], z: [] },
            velData: { x: [], y: [], z: [] },
            angleData: { roll: [], pitch: [], yaw: [] }
        }
    };

    return state;
}

function refreshDeviceSelect() {
    const sel = document.getElementById('deviceSelect');
    if (!sel) return;

    // 現在値を退避
    const current = sel.value;

    sel.innerHTML = '';

    const entries = Array.from(deviceStates.values());
    entries.sort((a, b) => (a.kind === 'serial' ? -1 : 1) - (b.kind === 'serial' ? -1 : 1));

    for (const st of entries) {
        const opt = document.createElement('option');
        opt.value = st.deviceId;
        opt.textContent = st.displayName;
        sel.appendChild(opt);
    }

    if (deviceStates.has(current)) {
        sel.value = current;
    } else if (deviceStates.has(activeDeviceId)) {
        sel.value = activeDeviceId;
    } else if (entries.length) {
        sel.value = entries[0].deviceId;
    }

    setActiveDevice(sel.value);
}

function setActiveDevice(id) {
    if (!deviceStates.has(id)) return;
    activeDeviceId = id;

    // Chartの参照を切り替え
    const st = deviceStates.get(activeDeviceId);
    syncChartToState(st);

    // 画面の数値更新（次の受信が来るまで）
    updateDOMFromState(st);
}

function syncChartToState(st) {
    // labels
    timeLabels.length = 0;
    timeLabels.push(...st.history.timeLabels);

    posData.x.length = 0; posData.y.length = 0; posData.z.length = 0;
    velData.x.length = 0; velData.y.length = 0; velData.z.length = 0;
    angleData.roll.length = 0; angleData.pitch.length = 0; angleData.yaw.length = 0;

    posData.x.push(...st.history.posData.x);
    posData.y.push(...st.history.posData.y);
    posData.z.push(...st.history.posData.z);

    velData.x.push(...st.history.velData.x);
    velData.y.push(...st.history.velData.y);
    velData.z.push(...st.history.velData.z);

    angleData.roll.push(...st.history.angleData.roll);
    angleData.pitch.push(...st.history.angleData.pitch);
    angleData.yaw.push(...st.history.angleData.yaw);

    if (accelChart && gyroChart) {
        accelChart.data.labels = st.history.timeLabels;
        accelChart.data.datasets[0].data = posData.x;
        accelChart.data.datasets[1].data = posData.y;
        accelChart.data.datasets[2].data = posData.z;
        accelChart.update();

        gyroChart.data.labels = st.history.timeLabels;
        gyroChart.data.datasets[0].data = angleData.roll;
        gyroChart.data.datasets[1].data = angleData.pitch;
        gyroChart.data.datasets[2].data = angleData.yaw;
        gyroChart.update();
    }
}

function updateDOMFromState(st) {
    const rollDeg = (st.rollKF.angle - st.roll0) * 180 / Math.PI;
    const pitchDeg = (st.pitchKF.angle - st.pitch0) * 180 / Math.PI;
    const yawRelDeg = wrapRad(st.yaw - st.yaw0) * 180 / Math.PI;

    // 位置/速度
    document.getElementById('accelX').textContent = st.posKF.x.p.toFixed(3);
    document.getElementById('accelY').textContent = st.posKF.y.p.toFixed(3);
    document.getElementById('accelZ').textContent = st.posKF.z.p.toFixed(3);

    document.getElementById('gyroX').textContent = st.posKF.x.v.toFixed(3);
    document.getElementById('gyroY').textContent = st.posKF.y.v.toFixed(3);
    document.getElementById('gyroZ').textContent = st.posKF.z.v.toFixed(3);

    // 姿勢
    document.getElementById('roll').textContent = rollDeg.toFixed(1) + '°';
    document.getElementById('pitch').textContent = pitchDeg.toFixed(1) + '°';
    document.getElementById('yaw').textContent = yawRelDeg.toFixed(1) + '°';

    document.getElementById('packetCount').textContent = st.packetCount || 0;
    document.getElementById('sampleRate').textContent = (st.lastSampleRateHz || 0).toFixed(1) + ' Hz';
}

function syncTrajectoryVisibility() {
    for (const st of deviceStates.values()) {
        if (st && st.line) st.line.visible = trajectoryEnabled;
    }
}

function removeDevice(deviceId) {
    if (!deviceStates.has(deviceId)) return;
    const st = deviceStates.get(deviceId);
    deviceStates.delete(deviceId);

    // 3D削除
    try {
        if (st.cube) scene.remove(st.cube);
        if (st.line) scene.remove(st.line);
        if (st.cube?.geometry) st.cube.geometry.dispose();
        if (st.cube?.material) st.cube.material.dispose();
        if (st.line?.geometry) st.line.geometry.dispose();
        if (st.line?.material) st.line.material.dispose();
    } catch (e) {
        // ignore
    }

    try {
        // BLE切断
        if (st.ble?.characteristic) {
            st.ble.characteristic.removeEventListener('characteristicvaluechanged', st.ble.handler);
            st.ble.characteristic.stopNotifications().catch(() => { });
        }
        if (st.ble?.bleDevice?.gatt?.connected) {
            st.ble.bleDevice.gatt.disconnect();
        }
    } catch (e) {
        // ignore
    }

    // アクティブが消えたらフォールバック
    if (activeDeviceId === deviceId) {
        const ids = Array.from(deviceStates.keys());
        activeDeviceId = ids.length ? ids[0] : 'serial';
    }

    refreshDeviceSelect();
    updateStatus('disconnected', `接続解除: ${st.displayName}`);
    syncTrajectoryVisibility();
}

// 接続ボタンのテキスト更新
function updateConnectionButtonText() {
    const btnText = document.getElementById('connectBtnText');
    if (isConnected) {
        btnText.textContent = '切断';
    } else {
        if (connectionMode === 'serial') {
            btnText.textContent = 'シリアルポートに接続';
        } else {
            btnText.textContent = 'Bluetoothに接続';
        }
    }
}

// 接続/切断トグル
async function toggleConnection() {
    if (isConnected) {
        await disconnect();
    } else {
        if (connectionMode === 'serial') {
            await connectSerial();
        } else {
            await connectBluetooth();
        }
    }
}

// シリアル接続
async function connectSerial() {
    try {
        disableAddBleButton();
        // シリアルポートを選択
        port = await navigator.serial.requestPort();

        // ポートを開く（ボーレート: 115200）
        await port.open({ baudRate: 115200 });

        isConnected = true;
        updateStatus('connected', 'シリアル接続中');
        updateConnectionButtonText();

        // serialデバイス状態（1台のみ）
        if (!deviceStates.has('serial')) {
            const st = createDeviceState({
                deviceId: 'serial',
                displayName: 'Serial#USB',
                color: 0x00d4ff,
                kind: 'serial',
                cubeStartIndex: 0
            });
            deviceStates.set('serial', st);
        }

        refreshDeviceSelect();
        setActiveDevice('serial');

        // データ読み取り開始
        readSerialData();

    } catch (error) {
        console.error('接続エラー:', error);
        updateStatus('error', '接続失敗');
        alert('シリアルポートへの接続に失敗しました。\n' + error.message);
    }
}

// Bluetooth（最大10台まで同時接続）
async function connectBluetooth() {
    try {
        if (!navigator.bluetooth) {
            throw new Error('このブラウザはWeb Bluetooth APIをサポートしていません。');
        }

        isConnected = false;
        updateStatus('disconnected', 'Bluetooth接続中...');
        updateConnectionButtonText();

        bleDevices.length = 0;
        // 前モードの3Dオブジェクトも含めて整理
        const prevIds = Array.from(deviceStates.keys());
        for (const id of prevIds) removeDevice(id);

        // 1回のユーザー操作で接続できるのは1台のみ
        // （requestDevice() を複数回ループすると2台目以降で権限ダイアログが失敗する）
        let bleDevice;
        try {
        bleDevice = await requestOneBleDevice();
        } catch (e) {
            if (e && e.name === 'NotFoundError') {
                updateStatus('disconnected', '未接続');
                disableAddBleButton();
                alert('BLEデバイスが見つかりませんでした。\n\nボードの電源を入れ、広告を開始した状態で再試行してください。\nまた、他のアプリ（Bluetooth接続ツール等）で既に接続していないことを確認してください。');
                return;
            }
            throw e;
        }

        if (!bleDevice) {
            updateStatus('disconnected', '未接続');
            disableAddBleButton();
            return;
        }

        const deviceId = bleDevice.id;
        const color = BLE_COLORS[0];
        await connectOneBluetoothDevice(bleDevice, color, 1);

        const bleCount = getConnectedBleCount();
        isConnected = true;
        updateStatus('connected', `Bluetooth接続中 (${bleCount}台)`);
        updateConnectionButtonText();
        refreshDeviceSelect();
        enableAddBleButton();

    } catch (error) {
        console.error('Bluetooth接続エラー:', error);
        updateStatus('error', '接続失敗');
        alert('Bluetooth接続に失敗しました。\n\n' + (error?.message || String(error)));
    }
}

function getConnectedBleCount() {
    let n = 0;
    for (const [id, st] of deviceStates.entries()) {
        if (st && st.kind === 'ble') n++;
    }
    return n;
}

function disableAddBleButton() {
    const btn = document.getElementById('addBleBtn');
    if (btn) btn.disabled = true;
}

function enableAddBleButton() {
    const btn = document.getElementById('addBleBtn');
    if (btn) btn.disabled = getConnectedBleCount() >= MAX_BLE_DEVICES;
}

// ユーザー操作（クリック）で1台ずつ追加接続する
async function connectAdditionalBluetoothDevice() {
    if (!navigator.bluetooth) {
        alert('このブラウザはWeb Bluetooth APIをサポートしていません。');
        return;
    }
    if (getConnectedBleCount() >= MAX_BLE_DEVICES) {
        alert('最大接続数（10台）に達しています。');
        disableAddBleButton();
        return;
    }

    try {
        // 追加接続は「クリックハンドラの中」で1回だけ requestDevice を呼ぶ
        const bleDevice = await requestOneBleDevice();

        if (!bleDevice) return;

        const deviceId = bleDevice.id;
        if (deviceStates.has(deviceId)) {
            alert('同じデバイスが既に接続されています。');
            enableAddBleButton();
            return;
        }

        const existingBle = Array.from(deviceStates.values()).filter(s => s.kind === 'ble');
        const color = BLE_COLORS[existingBle.length % BLE_COLORS.length];
        // cubeStartIndexは重なり回避のため順番で付与
        await connectOneBluetoothDevice(bleDevice, color, existingBle.length + 1);

        const bleCount = getConnectedBleCount();
        updateStatus('connected', `Bluetooth接続中 (${bleCount}台)`);
        refreshDeviceSelect();
        enableAddBleButton();
    } catch (error) {
        // ユーザーがキャンセルした場合は静かに扱う
        if (error && error.name === 'NotFoundError') {
            alert('BLEデバイスが見つかりませんでした。\n\nボードの電源を入れ、広告を開始した状態で再試行してください。');
        } else {
            console.warn('BLE追加接続キャンセル/失敗:', error);
        }
        enableAddBleButton();
    }
}

async function connectOneBluetoothDevice(bleDevice, color, index) {
    const deviceId = bleDevice.id;
    const displayName = `${bleDevice.name || 'XIAO'}#${index}`;

    const server = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService(UART_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(UART_TX_CHAR_UUID);

    await characteristic.startNotifications();

    // デバイス状態を作成（3D + フィルタ）
    const state = createDeviceState({
        deviceId,
        displayName,
        color,
        kind: 'ble',
        cubeStartIndex: index
    });
    deviceStates.set(deviceId, state);
    bleDevices.push(deviceId);

    // 通知ハンドラ（デバイスごとにクロージャ）
    const handler = (event) => handleBluetoothNotification(event, deviceId);
    characteristic.addEventListener('characteristicvaluechanged', handler);

    // 切断時
    bleDevice.addEventListener('gattserverdisconnected', () => {
        removeDevice(deviceId);
    });

    // gatt/charを保持して切断時に止める
    state.ble = { bleDevice, server, characteristic, handler };

    // 初期値（次の受信で原点合わせ）
    state.textBuffer = '';
    state.originSet = false;
    state.lastUpdateMs = 0;

    // すぐ表示更新したい場合のために初期角度
    state.cube.visible = true;
    state.line.visible = trajectoryEnabled;
}

// 切断
async function disconnect() {
    try {
        if (connectionMode === 'serial') {
            // シリアル切断
            if (reader) {
                await reader.cancel();
                reader = null;
            }

            if (port) {
                await port.close();
                port = null;
            }

            removeDevice('serial');
        } else {
            // Bluetooth切断
            const ids = Array.from(deviceStates.keys());
            for (const id of ids) removeDevice(id);
        }

        isConnected = false;
        disableAddBleButton();
        updateStatus('disconnected', '未接続');
        updateConnectionButtonText();

    } catch (error) {
        console.error('切断エラー:', error);
    }
}

// デバイスごとのBluetoothテキストバッファは deviceStates[deviceId].textBuffer を使用

// バイナリBLEデータのデコード
function decodeBinaryBLE(arrayBuffer) {
    const view = new DataView(arrayBuffer);

    // 13ビット値のデコード (符号拡張付き)
    function decode13bit(bits) {
        // 13ビット目が1なら負数として符号拡張
        if (bits & 0x1000) {
            // 負数: 16ビットに符号拡張してから変換
            bits = bits | 0xE000;
            // JavaScriptの符号付き整数として扱う
            bits = (bits << 16) >> 16;
        }
        return bits / 16.0;
    }

    // 加速度データを抽出 (バイト0-4)
    const ax = (view.getUint8(0) | ((view.getUint8(1) & 0x1F) << 8));
    const ay = ((view.getUint8(1) >> 5) | (view.getUint8(2) << 3) | ((view.getUint8(3) & 0x03) << 11));
    const az = ((view.getUint8(3) >> 2) | ((view.getUint8(4) & 0x7F) << 6));

    // ジャイロデータを抽出 (バイト5-9)
    const gx = (view.getUint8(5) | ((view.getUint8(6) & 0x1F) << 8));
    const gy = ((view.getUint8(6) >> 5) | (view.getUint8(7) << 3) | ((view.getUint8(8) & 0x03) << 11));
    const gz = ((view.getUint8(8) >> 2) | ((view.getUint8(9) & 0x7F) << 6));

    // 温度データを抽出 (バイト10-11)
    const tempInt = view.getInt8(10);
    const tempFrac = view.getUint8(11) / 256.0;

    return {
        accel: {
            x: decode13bit(ax),
            y: decode13bit(ay),
            z: decode13bit(az)
        },
        gyro: {
            x: decode13bit(gx),
            y: decode13bit(gy),
            z: decode13bit(gz)
        },
        temp: tempInt + tempFrac
    };
}

// Bluetooth通知ハンドラー（デバイスごと）
function handleBluetoothNotification(event, deviceId) {
    const st = deviceStates.get(deviceId);
    if (!st) return;

    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(value);

    // バイナリ形式かチェック (12バイト)
    if (value.byteLength === 12) {
        try {
            const data = decodeBinaryBLE(value.buffer);
            data.timestamp = Date.now(); // BLEにはtimestampが無いので受信時刻で補う
            processData(data, deviceId);
        } catch (error) {
            console.error('❌ バイナリデコードエラー:', error);
        }
        return;
    }

    // バッファに追加
    st.textBuffer += text;

    // 改行が含まれている場合のみ処理
    if (st.textBuffer.includes('\n')) {
        const lines = st.textBuffer.split('\n');

        // 最後の要素は未完成の可能性があるので保持
        st.textBuffer = lines.pop() || '';

        // 完全な行を処理
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.length === 0) return;

            try {
                let data;
                // カンマ区切りの場合（BLE）
                if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                    const values = trimmed.split(',').map(v => parseFloat(v));
                    if (values.length >= 6) {  // 6個以上あればOK
                        data = values;
                    }
                } else {
                    // JSON形式（配列またはオブジェクト）
                    data = JSON.parse(trimmed);
                }

                if (data) {
                    processData(data, deviceId);
                }
            } catch (error) {
                console.error('❌ エラー:', error.message);
                console.error('   データ:', trimmed);
            }
        });
    }
}

// シリアルデータ読み取り
async function readSerialData() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();

    let buffer = '';

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += value;

            // 改行で分割してJSON解析
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 最後の不完全な行を保持

            for (const line of lines) {
                if (line.trim()) {
                    processSerialLine(line.trim());
                }
            }
        }
    } catch (error) {
        console.error('読み取りエラー:', error);
        updateStatus('error', '読み取りエラー');
    } finally {
        reader.releaseLock();
    }
}

// データ処理（シリアル・Bluetooth共通）
function processData(data, deviceId = activeDeviceId) {
    const st = deviceStates.get(deviceId);
    if (!st) return;
    if (!data) return;

    // BLE配列形式（CSVなど）を標準オブジェクトに変換
    if (Array.isArray(data) && data.length >= 6) {
        data = {
            accel: { x: data[0] / 100, y: data[1] / 100, z: data[2] / 100 },
            gyro: { x: data[3] / 10, y: data[4] / 10, z: data[5] / 10 },
            temp: data[6] || 0,
            timestamp: data[7] || undefined
        };
    } else if (data.a && !data.accel) {
        // 短縮キーを標準キーへ
        data.accel = data.a;
        data.gyro = data.g;
        data.temp = data.t;
    }

    if (!data.accel || !data.gyro) return;

    const currentTimeMs = data.timestamp || Date.now();
    const dt = st.lastUpdateMs > 0 ? (currentTimeMs - st.lastUpdateMs) / 1000 : 0;
    st.lastUpdateMs = currentTimeMs;

    // 受信カウント
    st.packetCount++;
    if (dt > 0) st.lastSampleRateHz = 1 / dt;

    const ax = data.accel.x;
    const ay = data.accel.y;
    const az = data.accel.z;

    const gxDeg = data.gyro.x;
    const gyDeg = data.gyro.y;
    const gzDeg = data.gyro.z;

    // 加速度からRoll/Pitch観測（rad）
    const accelRoll = Math.atan2(ay, az);
    const accelPitch = Math.atan2(-ax, Math.sqrt(ay * ay + az * az));

    // 静止判定（ZUPT用）
    const gyroMag = Math.sqrt(gxDeg * gxDeg + gyDeg * gyDeg + gzDeg * gzDeg); // deg/s
    const accelMag = Math.sqrt(ax * ax + ay * ay + az * az); // m/s^2

    st.gyroMagHistory.push(gyroMag);
    const histLimit = Math.max(5, MA_WINDOW_SIZE);
    if (st.gyroMagHistory.length > histLimit) st.gyroMagHistory.shift();

    const gyroMagMA = average(st.gyroMagHistory);
    const gyroChange = Math.abs(gyroMag - gyroMagMA);
    const isStationaryGyro = gyroMag < (GYRO_THRESHOLD * 1.2);
    const isStationaryAccel = Math.abs(accelMag - 9.81) < 1.5;
    const isGyroStable = gyroChange < DRIFT_CHANGE_THRESHOLD;
    // yawバイアス推定などに使う（位置のZUPT判定は後で lineAcc を見て決める）
    const applyZUPTYaw = ENABLE_DRIFT_COMPENSATION && isStationaryGyro && isStationaryAccel && isGyroStable;

    // 初期基準（初期姿勢で相対化）
    if (!st.originSet) {
        // 初期姿勢における重力成分を加速度から初期化（沈み込みを抑える）
        st.gravityBody.set(ax, ay, az);

        st.rollKF.setInitial(accelRoll);
        st.pitchKF.setInitial(accelPitch);
        st.roll0 = accelRoll;
        st.pitch0 = accelPitch;
        st.yaw = 0;
        st.yawBias = 0;
        st.yaw0 = 0;

        st.posKF.x.reset();
        st.posKF.y.reset();
        st.posKF.z.reset();

        st.trajPoints = [];
        st.line.geometry.setFromPoints([new THREE.Vector3(0, 0, 0)]);

        st.history.timeLabels = [];
        st.history.posData.x = [];
        st.history.posData.y = [];
        st.history.posData.z = [];
        st.history.velData.x = [];
        st.history.velData.y = [];
        st.history.velData.z = [];
        st.history.angleData.roll = [];
        st.history.angleData.pitch = [];
        st.history.angleData.yaw = [];

        st.cube.rotation.set(0, 0, 0);
        st.cube.position.set(0, 0, 0);
        st.originSet = true;

        if (deviceId === activeDeviceId) {
            if (data.temp !== undefined && document.getElementById('temperature')) {
                document.getElementById('temperature').textContent = data.temp.toFixed(1);
            }
            updateDOMFromState(st);
        }
        return;
    }

    // dtが変（通信遅延など）なら保守的に補正
    const dtClamped = (dt > 0 && dt < 0.2) ? dt : 0.01;

    // 姿勢（Roll/Pitch）Kalman更新
    const gx = gxDeg * DEG2RAD;
    const gy = gyDeg * DEG2RAD;
    const gz = gzDeg * DEG2RAD;

    st.rollKF.update(accelRoll, gx, dtClamped);
    st.pitchKF.update(accelPitch, gy, dtClamped);

    // Yaw（観測が無いので gyro + 静止時バイアス推定 + デッドゾーン）
    const yawDeadzone = GYRO_THRESHOLD * DEG2RAD;
    let gyroZRate = Math.abs(gzDeg) * DEG2RAD < yawDeadzone ? 0 : gz;

    if (ENABLE_DRIFT_COMPENSATION && applyZUPTYaw) {
        const alpha = 2 / (histLimit + 1);
        st.yawBias = st.yawBias + alpha * (gz - st.yawBias);
    }
    st.yaw = wrapRad(st.yaw + (gyroZRate - st.yawBias) * dtClamped);

    // 相対角度（初期基準）
    const rollRel = st.rollKF.angle - st.roll0;
    const pitchRel = st.pitchKF.angle - st.pitch0;
    const yawRel = wrapRad(st.yaw - st.yaw0);

    // 3D回転
    st.cube.rotation.x = pitchRel;
    st.cube.rotation.y = yawRel;
    st.cube.rotation.z = rollRel;

    // 重力を取り除いた線形加速度を基準座標へ（初期基準で相対化した回転を使用）
    // 重力のローパス推定（姿勢回転の誤差に引きずられないように、まずボディ座標で重力成分を推定して差し引く）
    const accelBody = new THREE.Vector3(ax, ay, az);
    const dtTau = st.gravityLpTauSec || 0.5;
    const alphaG = Math.exp(-dtClamped / dtTau);
    st.gravityBody.multiplyScalar(alphaG).add(accelBody.clone().multiplyScalar(1 - alphaG));
    const linearAccBody = accelBody.clone().sub(st.gravityBody);

    const euler = new THREE.Euler(pitchRel, yawRel, rollRel, 'XYZ');
    const q = new THREE.Quaternion().setFromEuler(euler);
    const linearAccWorld = linearAccBody.applyQuaternion(q);

    // 静止判定は「重力除去後の線形加速度が十分小さい」ことを優先する
    const linearAccMag = linearAccBody.length();
    const applyZUPTPosNow = ENABLE_DRIFT_COMPENSATION && isStationaryGyro && isGyroStable && linearAccMag < LINACC_THRESHOLD;
    st.stationaryPosCount = applyZUPTPosNow ? (st.stationaryPosCount + 1) : 0;
    const doZUPTPos = st.stationaryPosCount >= ZUPT_POS_STREAK;

    // ZUPT成立時は予測入力（加速度）を0に抑え、さらに速度状態を強制0にして位置更新を止める
    if (doZUPTPos) {
        st.posKF.x.forceVelocity(0);
        st.posKF.y.forceVelocity(0);
        st.posKF.z.forceVelocity(0);
    }

    const accForPredict = doZUPTPos ? new THREE.Vector3(0, 0, 0) : linearAccWorld;

    // 位置/速度 Kalman更新（ZUPTで速度観測=v=0）
    st.posKF.x.predict(accForPredict.x, dtClamped);
    st.posKF.y.predict(accForPredict.y, dtClamped);
    st.posKF.z.predict(accForPredict.z, dtClamped);

    if (doZUPTPos) {
        st.posKF.x.updateVelocity(0);
        st.posKF.y.updateVelocity(0);
        st.posKF.z.updateVelocity(0);
    }

    // 3D位置
    st.cube.position.set(
        st.posKF.x.p * POS_SCALE,
        st.posKF.y.p * POS_SCALE,
        st.posKF.z.p * POS_SCALE
    );

    // 軌跡（ONのときだけ追記）
    st.line.visible = trajectoryEnabled;
    if (trajectoryEnabled) {
        st.trajPoints.push(new THREE.Vector3(st.posKF.x.p, st.posKF.y.p, st.posKF.z.p));
        if (st.trajPoints.length > TRAJ_MAX_POINTS) st.trajPoints.shift();

        const scaledPoints = st.trajPoints.map(p => new THREE.Vector3(p.x * POS_SCALE, p.y * POS_SCALE, p.z * POS_SCALE));
        st.line.geometry.setFromPoints(scaledPoints);
    }

    // 履歴（グラフ用）
    const now = new Date();
    const label = now.getSeconds() + '.' + Math.floor(now.getMilliseconds() / 100);

    const rollRelDeg = rollRel * 180 / Math.PI;
    const pitchRelDeg = pitchRel * 180 / Math.PI;
    const yawRelDeg = yawRel * 180 / Math.PI;

    st.history.timeLabels.push(label);
    st.history.posData.x.push(st.posKF.x.p);
    st.history.posData.y.push(st.posKF.y.p);
    st.history.posData.z.push(st.posKF.z.p);

    st.history.velData.x.push(st.posKF.x.v);
    st.history.velData.y.push(st.posKF.y.v);
    st.history.velData.z.push(st.posKF.z.v);

    st.history.angleData.roll.push(rollRelDeg);
    st.history.angleData.pitch.push(pitchRelDeg);
    st.history.angleData.yaw.push(yawRelDeg);

    if (st.history.timeLabels.length > MAX_DATA_POINTS) {
        st.history.timeLabels.shift();
        st.history.posData.x.shift();
        st.history.posData.y.shift();
        st.history.posData.z.shift();
        st.history.velData.x.shift();
        st.history.velData.y.shift();
        st.history.velData.z.shift();
        st.history.angleData.roll.shift();
        st.history.angleData.pitch.shift();
        st.history.angleData.yaw.shift();
    }

    // 選択中のみDOM/Charts更新
    if (deviceId === activeDeviceId) {
        if (data.temp !== undefined && document.getElementById('temperature')) {
            document.getElementById('temperature').textContent = data.temp.toFixed(1);
        }

        updateDOMFromState(st);

        // Chart更新（Activeのみ）
        if (accelChart && gyroChart) {
            accelChart.data.labels = st.history.timeLabels;
            accelChart.data.datasets[0].data = st.history.posData.x;
            accelChart.data.datasets[1].data = st.history.posData.y;
            accelChart.data.datasets[2].data = st.history.posData.z;
            accelChart.update();

            gyroChart.data.labels = st.history.timeLabels;
            gyroChart.data.datasets[0].data = st.history.angleData.roll;
            gyroChart.data.datasets[1].data = st.history.angleData.pitch;
            gyroChart.data.datasets[2].data = st.history.angleData.yaw;
            gyroChart.update();
        }
    }
}

// シリアルデータ処理 (この関数はprocessDataに統合されるため、中身を変更)
function processSerialLine(line) {
    // JSON形式のデータを解析
    if (line.startsWith('{')) {
        try {
            const data = JSON.parse(line);
            processData(data, 'serial'); // serialデバイスとして処理
        } catch (error) {
            console.error('JSON解析エラー:', error, line);
        }
    }
}

// センサーデータ更新
function updateSensorData(data) {
    // 加速度データ
    document.getElementById('accelX').textContent = data.accel.x.toFixed(3);
    document.getElementById('accelY').textContent = data.accel.y.toFixed(3);
    document.getElementById('accelZ').textContent = data.accel.z.toFixed(3);

    // ジャイロデータ
    document.getElementById('gyroX').textContent = data.gyro.x.toFixed(3);
    document.getElementById('gyroY').textContent = data.gyro.y.toFixed(3);
    document.getElementById('gyroZ').textContent = data.gyro.z.toFixed(3);

    // 温度データ
    if (data.temp !== undefined) {
        document.getElementById('temperature').textContent = data.temp.toFixed(1);
    }

    // グラフ用データ追加
    addDataPoint(accelData, data.accel);
    addDataPoint(gyroData, data.gyro);

    const now = new Date();
    timeLabels.push(now.getSeconds() + '.' + Math.floor(now.getMilliseconds() / 100));

    // データポイント数を制限
    if (timeLabels.length > MAX_DATA_POINTS) {
        timeLabels.shift();
        accelData.x.shift();
        accelData.y.shift();
        accelData.z.shift();
        gyroData.x.shift();
        gyroData.y.shift();
        gyroData.z.shift();
    }
}

// データポイント追加
function addDataPoint(dataObj, values) {
    dataObj.x.push(values.x);
    dataObj.y.push(values.y);
    dataObj.z.push(values.z);
}

// 姿勢推定（相補フィルター + ドリフト補正）
function updateOrientation(data) {
    const now = Date.now();
    const dt = (now - lastUpdateTime) / 1000; // 秒
    lastUpdateTime = now;

    // 加速度から傾斜角を計算
    const accelRoll = Math.atan2(data.accel.y, data.accel.z) * 180 / Math.PI;
    const accelPitch = Math.atan2(-data.accel.x, Math.sqrt(data.accel.y * data.accel.y + data.accel.z * data.accel.z)) * 180 / Math.PI;

    // ジャイロデータの処理
    let gyroX = data.gyro.x;
    let gyroY = data.gyro.y;
    let gyroZ = data.gyro.z;

    // ドリフト補正が有効な場合
    if (ENABLE_DRIFT_COMPENSATION) {
        // 移動平均バッファに追加
        gyroHistory.x.push(data.gyro.x);
        gyroHistory.y.push(data.gyro.y);
        gyroHistory.z.push(data.gyro.z);

        // ウィンドウサイズを超えたら古いデータを削除
        if (gyroHistory.x.length > MA_WINDOW_SIZE) {
            gyroHistory.x.shift();
            gyroHistory.y.shift();
            gyroHistory.z.shift();
        }

        // 移動平均を計算
        const maX = gyroHistory.x.reduce((sum, val) => sum + val, 0) / gyroHistory.x.length;
        const maY = gyroHistory.y.reduce((sum, val) => sum + val, 0) / gyroHistory.y.length;
        const maZ = gyroHistory.z.reduce((sum, val) => sum + val, 0) / gyroHistory.z.length;

        // 移動平均からの変化量を計算
        const changeX = Math.abs(data.gyro.x - maX);
        const changeY = Math.abs(data.gyro.y - maY);
        const changeZ = Math.abs(data.gyro.z - maZ);

        // 閾値以上の変化がある場合のみ移動平均を更新
        if (changeX > DRIFT_CHANGE_THRESHOLD) {
            gyroMovingAverage.x = maX;
        }
        if (changeY > DRIFT_CHANGE_THRESHOLD) {
            gyroMovingAverage.y = maY;
        }
        if (changeZ > DRIFT_CHANGE_THRESHOLD) {
            gyroMovingAverage.z = maZ;
        }

        // 移動平均を減算してドリフトをキャンセル
        gyroX = data.gyro.x - gyroMovingAverage.x;
        gyroY = data.gyro.y - gyroMovingAverage.y;
        gyroZ = data.gyro.z - gyroMovingAverage.z;
    }

    // デッドゾーンを適用
    gyroX = Math.abs(gyroX) > GYRO_THRESHOLD ? gyroX : 0;
    gyroY = Math.abs(gyroY) > GYRO_THRESHOLD ? gyroY : 0;
    gyroZ = Math.abs(gyroZ) > GYRO_THRESHOLD ? gyroZ : 0;

    // ジャイロから角速度を積分
    roll += gyroX * dt;
    pitch += gyroY * dt;
    yaw += gyroZ * dt;

    // 相補フィルター適用（Roll/Pitchのみ）
    roll = ALPHA * roll + (1 - ALPHA) * accelRoll;
    pitch = ALPHA * pitch + (1 - ALPHA) * accelPitch;

    // 表示更新
    document.getElementById('roll').textContent = roll.toFixed(1) + '°';
    document.getElementById('pitch').textContent = pitch.toFixed(1) + '°';
    document.getElementById('yaw').textContent = yaw.toFixed(1) + '°';
}

// 姿勢をリセット
function resetOrientation() {
    for (const st of deviceStates.values()) {
        st.originSet = false;
        st.roll0 = 0;
        st.pitch0 = 0;
        st.yaw0 = 0;

        st.yaw = 0;
        st.yawBias = 0;

        // 内部状態の初期化（次の受信で観測から再設定）
        st.rollKF.setInitial(0);
        st.pitchKF.setInitial(0);
        st.posKF.x.reset();
        st.posKF.y.reset();
        st.posKF.z.reset();

        st.trajPoints = [];
        st.line.geometry.setFromPoints([new THREE.Vector3(0, 0, 0)]);

        st.cube.rotation.set(0, 0, 0);
        st.cube.position.set(0, 0, 0);

        st.history.timeLabels = [];
        st.history.posData.x = [];
        st.history.posData.y = [];
        st.history.posData.z = [];
        st.history.velData.x = [];
        st.history.velData.y = [];
        st.history.velData.z = [];
        st.history.angleData.roll = [];
        st.history.angleData.pitch = [];
        st.history.angleData.yaw = [];

        st.gyroMagHistory = [];

        st.packetCount = 0;
        st.lastSampleRateHz = 0;
        st.lastUpdateMs = 0;
    }

    syncTrajectoryVisibility();
    if (deviceStates.has(activeDeviceId)) {
        updateDOMFromState(deviceStates.get(activeDeviceId));
    }
}

// Three.js 初期化
function initThreeJS() {
    const container = document.getElementById('threejs-container');

    // シーン作成
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x151932);

    // カメラ作成
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    // レンダラー作成
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // 軸ヘルパー追加
    axesHelper = new THREE.AxesHelper(3);
    scene.add(axesHelper);

    // ライト追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // 描画ループ（デバイス更新分を常に反映）
    function animate() {
        requestAnimationFrame(animate);
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }
    animate();

    // ウィンドウリサイズ対応
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// 3Dビジュアライゼーション更新
function update3DVisualization() {
    if (cube) {
        // オイラー角を適用（度からラジアンに変換）
        cube.rotation.x = pitch * Math.PI / 180;
        cube.rotation.y = yaw * Math.PI / 180;
        cube.rotation.z = roll * Math.PI / 180;

        renderer.render(scene, camera);
    }
}

// Chart.js 初期化
function initCharts() {
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    labels: { color: '#a0aec0' }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#a0aec0' },
                    grid: { color: 'rgba(160, 174, 192, 0.1)' }
                },
                y: {
                    ticks: { color: '#a0aec0' },
                    grid: { color: 'rgba(160, 174, 192, 0.1)' }
                }
            }
        }
    };

    // 位置変化グラフ（相対位置）
    accelChart = new Chart(document.getElementById('accelChart'), {
        ...chartConfig,
        data: {
            labels: timeLabels,
            datasets: [
                { label: 'X', data: posData.x, borderColor: '#ff6b6b', backgroundColor: 'rgba(255, 107, 107, 0.1)', tension: 0.4 },
                { label: 'Y', data: posData.y, borderColor: '#4ecdc4', backgroundColor: 'rgba(78, 205, 196, 0.1)', tension: 0.4 },
                { label: 'Z', data: posData.z, borderColor: '#ffe66d', backgroundColor: 'rgba(255, 230, 109, 0.1)', tension: 0.4 }
            ]
        }
    });

    // 向き変化グラフ（相対角度）
    gyroChart = new Chart(document.getElementById('gyroChart'), {
        ...chartConfig,
        data: {
            labels: timeLabels,
            datasets: [
                { label: 'Roll', data: angleData.roll, borderColor: '#ff6b6b', backgroundColor: 'rgba(255, 107, 107, 0.1)', tension: 0.4 },
                { label: 'Pitch', data: angleData.pitch, borderColor: '#4ecdc4', backgroundColor: 'rgba(78, 205, 196, 0.1)', tension: 0.4 },
                { label: 'Yaw', data: angleData.yaw, borderColor: '#ffe66d', backgroundColor: 'rgba(255, 230, 109, 0.1)', tension: 0.4 }
            ]
        }
    });
}

// グラフ更新
function updateCharts() {
    accelChart.update();
    gyroChart.update();
}

// ステータス更新
function updateStatus(status, text) {
    const statusElement = document.getElementById('status');
    statusElement.className = 'status ' + status;
    statusElement.querySelector('.status-text').textContent = text;
}
