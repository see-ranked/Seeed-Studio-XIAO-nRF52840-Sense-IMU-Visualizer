// XIAO nRF52840 Sense IMU Visualizer
// Web Serial API を使用してシリアルデータを受信し、3Dビジュアライゼーションとグラフを表示

// グローバル変数
let port;
let reader;
let isConnected = false;
let connectionMode = 'serial'; // 'serial' or 'bluetooth'

// Bluetooth変数
let bleDevice;
let bleCharacteristic;
let scene, camera, renderer, cube;
let accelChart, gyroChart;
let packetCount = 0;
let lastTimestamp = 0;
let sampleRate = 0;

// 姿勢推定用の変数（相補フィルター）
let roll = 0, pitch = 0, yaw = 0;
const ALPHA = 0.98; // 相補フィルターの係数
let GYRO_THRESHOLD = 0.5; // ジャイロのデッドゾーン（°/s）- この値以下は無視
let lastUpdateTime = Date.now();

// 移動平均フィルタ設定
let ENABLE_DRIFT_COMPENSATION = true; // ドリフト補正の有効/無効
let MA_WINDOW_SIZE = 20; // 移動平均のウィンドウサイズ（サンプル数）
let DRIFT_CHANGE_THRESHOLD = 0.3; // 変化閾値（°/s）- この値以上の変化のみ更新

// 移動平均バッファ
const gyroHistory = {
    x: [],
    y: [],
    z: []
};

// 移動平均値
let gyroMovingAverage = { x: 0, y: 0, z: 0 };

// データバッファ（グラフ用）
const MAX_DATA_POINTS = 50;
const accelData = { x: [], y: [], z: [] };
const gyroData = { x: [], y: [], z: [] };
const timeLabels = [];

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

    // ドリフト補正トグル
    const driftToggle = document.getElementById('driftCompensation');
    if (driftToggle) {
        driftToggle.addEventListener('change', (e) => {
            ENABLE_DRIFT_COMPENSATION = e.target.checked;
            console.log('ドリフト補正:', ENABLE_DRIFT_COMPENSATION ? 'ON' : 'OFF');
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
        // シリアルポートを選択
        port = await navigator.serial.requestPort();

        // ポートを開く（ボーレート: 115200）
        await port.open({ baudRate: 115200 });

        isConnected = true;
        updateStatus('connected', 'シリアル接続中');
        updateConnectionButtonText();

        // データ読み取り開始
        readSerialData();

    } catch (error) {
        console.error('接続エラー:', error);
        updateStatus('error', '接続失敗');
        alert('シリアルポートへの接続に失敗しました。\n' + error.message);
    }
}

// Bluetooth接続
async function connectBluetooth() {
    try {
        // Web Bluetooth APIのサポートチェック
        if (!navigator.bluetooth) {
            throw new Error('このブラウザはWeb Bluetooth APIをサポートしていません。');
        }

        updateStatus('disconnected', '接続中...');

        // BLEデバイスを検索（Bluefruit UART Service UUID）
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: 'XIAO' },
                { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] }
            ],
            optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
        });

        console.log('BLEデバイス検出:', bleDevice.name);

        // GATTサーバーに接続
        const server = await bleDevice.gatt.connect();
        console.log('GATT接続成功');

        // UART サービスを取得（Bluefruit UART Service）
        const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        console.log('UARTサービス取得');

        // TXキャラクタリスティックを取得（デバイスからの送信）
        bleCharacteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
        console.log('TXキャラクタリスティック取得');

        // 通知を有効化
        await bleCharacteristic.startNotifications();
        console.log('通知有効化');

        // データ受信ハンドラーを設定
        bleCharacteristic.addEventListener('characteristicvaluechanged', handleBluetoothData);

        isConnected = true;
        updateStatus('connected', 'Bluetooth接続中');
        updateConnectionButtonText();

        // 切断イベントハンドラー
        bleDevice.addEventListener('gattserverdisconnected', () => {
            console.log('Bluetooth切断');
            isConnected = false;
            updateStatus('disconnected', '未接続');
            updateConnectionButtonText();
        });

    } catch (error) {
        console.error('Bluetooth接続エラー:', error);
        updateStatus('error', '接続失敗');

        let errorMsg = 'Bluetooth接続に失敗しました。\n\n';
        if (error.name === 'NotFoundError') {
            errorMsg += '対応するデバイスが見つかりませんでした。\n\n確認事項:\n';
            errorMsg += '1. XIAOがBLEアドバタイズ中か確認\n';
            errorMsg += '2. シリアルモニターで "BLE initialized successfully!" を確認\n';
            errorMsg += '3. デバイス名が "XIAO_IMU" で始まるか確認\n';
            errorMsg += '4. 他のデバイスと接続していないか確認';
        } else {
            errorMsg += error.message;
        }
        alert(errorMsg);
    }
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
        } else {
            // Bluetooth切断
            if (bleCharacteristic) {
                await bleCharacteristic.stopNotifications();
                bleCharacteristic.removeEventListener('characteristicvaluechanged', handleBluetoothData);
                bleCharacteristic = null;
            }

            if (bleDevice && bleDevice.gatt.connected) {
                await bleDevice.gatt.disconnect();
            }
            bleDevice = null;
        }

        isConnected = false;
        updateStatus('disconnected', '未接続');
        updateConnectionButtonText();

    } catch (error) {
        console.error('切断エラー:', error);
    }
}

// Bluetoothデータバッファ
let bleBuffer = '';

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

// Bluetoothデータハンドラー
function handleBluetoothData(event) {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(value);

    // バイナリ形式かチェック (12バイト)
    if (value.byteLength === 12) {
        console.log('📦 バイナリデータ受信:', value.byteLength, 'bytes');

        try {
            const data = decodeBinaryBLE(value.buffer);
            console.log('✨ デコード成功:', data);
            processData(data);
        } catch (error) {
            console.error('❌ バイナリデコードエラー:', error);
        }
        return;
    }

    // バッファに追加
    bleBuffer += text;

    // 改行が含まれている場合のみ処理
    if (bleBuffer.includes('\n')) {
        console.log('✅ 完全バッファ:', JSON.stringify(bleBuffer));
        const lines = bleBuffer.split('\n');

        // 最後の要素は未完成の可能性があるので保持
        bleBuffer = lines.pop() || '';

        // 完全な行を処理
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.length === 0) return;

            console.log('🔍 解析:', trimmed);

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
                    console.log('✨ 成功!');
                    processData(data);
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
function processData(data) {
    packetCount++;

    // BLE配列形式を標準オブジェクトに変換 [ax,ay,az,gx,gy,gz,t]
    if (Array.isArray(data) && data.length >= 6) {
        // 整数からデスケーリング: accel/100, gyro/10, temp/1
        data = {
            accel: { x: data[0] / 100, y: data[1] / 100, z: data[2] / 100 },
            gyro: { x: data[3] / 10, y: data[4] / 10, z: data[5] / 10 },
            temp: data[6] || 0  // 7番目がない場合は0
        };
    }
    // BLE短縮キーを標準キーに変換
    else if (data.a && !data.accel) {
        data.accel = data.a;
        data.gyro = data.g;
        data.temp = data.t;
    }

    // タイムスタンプ処理（BLE経由の場合はtimestampがない）
    const currentTime = data.timestamp || Date.now();

    if (lastTimestamp > 0) {
        const deltaTime = currentTime - lastTimestamp;
        if (deltaTime > 0) {
            sampleRate = (1000 / deltaTime).toFixed(1);
        }
    }
    lastTimestamp = currentTime;

    // センサーデータ更新
    if (data.accel && data.gyro) {
        updateSensorData(data);
        updateOrientation(data);
        update3DVisualization();
        updateCharts();

        document.getElementById('packetCount').textContent = packetCount;
        document.getElementById('sampleRate').textContent = sampleRate + ' Hz';
    }
}

// シリアルデータ処理 (この関数はprocessDataに統合されるため、中身を変更)
function processSerialLine(line) {
    // JSON形式のデータを解析
    if (line.startsWith('{')) {
        try {
            const data = JSON.parse(line);
            processData(data); // processDataを呼び出すように変更
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
    roll = 0;
    pitch = 0;
    yaw = 0;

    // 移動平均バッファもクリア
    gyroHistory.x = [];
    gyroHistory.y = [];
    gyroHistory.z = [];
    gyroMovingAverage = { x: 0, y: 0, z: 0 };

    console.log('姿勢をリセットしました');
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

    // ボードを表す直方体を作成
    const geometry = new THREE.BoxGeometry(3, 0.3, 2);
    const material = new THREE.MeshPhongMaterial({
        color: 0x00d4ff,
        emissive: 0x003344,
        shininess: 100
    });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // エッジを追加
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    cube.add(wireframe);

    // 軸ヘルパー追加
    const axesHelper = new THREE.AxesHelper(3);
    scene.add(axesHelper);

    // ライト追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // 初期レンダリング
    renderer.render(scene, camera);

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

    // 加速度グラフ
    accelChart = new Chart(document.getElementById('accelChart'), {
        ...chartConfig,
        data: {
            labels: timeLabels,
            datasets: [
                { label: 'X', data: accelData.x, borderColor: '#ff6b6b', backgroundColor: 'rgba(255, 107, 107, 0.1)', tension: 0.4 },
                { label: 'Y', data: accelData.y, borderColor: '#4ecdc4', backgroundColor: 'rgba(78, 205, 196, 0.1)', tension: 0.4 },
                { label: 'Z', data: accelData.z, borderColor: '#ffe66d', backgroundColor: 'rgba(255, 230, 109, 0.1)', tension: 0.4 }
            ]
        }
    });

    // ジャイログラフ
    gyroChart = new Chart(document.getElementById('gyroChart'), {
        ...chartConfig,
        data: {
            labels: timeLabels,
            datasets: [
                { label: 'X', data: gyroData.x, borderColor: '#ff6b6b', backgroundColor: 'rgba(255, 107, 107, 0.1)', tension: 0.4 },
                { label: 'Y', data: gyroData.y, borderColor: '#4ecdc4', backgroundColor: 'rgba(78, 205, 196, 0.1)', tension: 0.4 },
                { label: 'Z', data: gyroData.z, borderColor: '#ffe66d', backgroundColor: 'rgba(255, 230, 109, 0.1)', tension: 0.4 }
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
