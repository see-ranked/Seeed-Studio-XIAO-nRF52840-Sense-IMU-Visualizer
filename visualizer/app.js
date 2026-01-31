// XIAO nRF52840 Sense IMU Visualizer
// Web Serial API を使用してシリアルデータを受信し、3Dビジュアライゼーションとグラフを表示

// グローバル変数
let port;
let reader;
let isConnected = false;
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

// 接続/切断トグル
async function toggleConnection() {
    if (isConnected) {
        await disconnect();
    } else {
        await connect();
    }
}

// シリアルポート接続
async function connect() {
    try {
        // ポート選択ダイアログを表示
        port = await navigator.serial.requestPort();

        // ポートを開く（ボーレート: 115200）
        await port.open({ baudRate: 115200 });

        isConnected = true;
        updateStatus('connected', '接続済み');
        document.getElementById('connectBtn').innerHTML = '<span class="btn-icon">🔌</span> 切断';

        // データ読み取り開始
        readSerialData();

    } catch (error) {
        console.error('接続エラー:', error);
        updateStatus('error', '接続失敗');
        alert('シリアルポートへの接続に失敗しました: ' + error.message);
    }
}

// シリアルポート切断
async function disconnect() {
    try {
        if (reader) {
            await reader.cancel();
            reader = null;
        }

        if (port) {
            await port.close();
            port = null;
        }

        isConnected = false;
        updateStatus('disconnected', '未接続');
        document.getElementById('connectBtn').innerHTML = '<span class="btn-icon">🔌</span> シリアルポートに接続';

    } catch (error) {
        console.error('切断エラー:', error);
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

// シリアルデータ処理
function processSerialLine(line) {
    // JSON形式のデータを解析
    if (line.startsWith('{')) {
        try {
            const data = JSON.parse(line);

            if (data.accel && data.gyro) {
                updateSensorData(data);
                updateOrientation(data);
                update3DVisualization();
                updateCharts();

                packetCount++;
                document.getElementById('packetCount').textContent = packetCount;

                // サンプルレート計算
                if (data.timestamp && lastTimestamp > 0) {
                    const deltaTime = (data.timestamp - lastTimestamp) / 1000; // 秒
                    if (deltaTime > 0) {
                        sampleRate = Math.round(1 / deltaTime);
                        document.getElementById('sampleRate').textContent = sampleRate + ' Hz';
                    }
                }
                lastTimestamp = data.timestamp;
            }

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
