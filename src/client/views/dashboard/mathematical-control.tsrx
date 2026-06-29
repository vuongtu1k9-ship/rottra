import { createSignal, createMemo, createEffect, onCleanup, Show, createResource, For } from "solid-js";
import { theme } from "~/client/stores/theme-store";
import { Icon } from "solid-heroicons";
import { fire, truck, puzzlePiece, mapPin, adjustmentsHorizontal } from "solid-heroicons/outline";

// Fetch dữ liệu Toán học từ SQL Database
const fetchMathCurriculum = async () => {
  const res = await fetch("/api/agent/math-curriculum");
  if (!res.ok) return [];
  const data = await res.json();
  return data.curriculum || [];
};

export component MathematicalControl(props: any) {
  const [mathData] = createResource(fetchMathCurriculum);
  // 1. 📍 VỊ TRÍ & ĐỊNH VỊ (Position & Coordinates)
  const [x, setX] = createSignal(12);
  const [y, setY] = createSignal(16);
  const [z, setZ] = createSignal(6);
  const [v, setV] = createSignal(4.5); // Vận tốc m/s

  const distance = createMemo(() => parseFloat(Math.sqrt(x() * x() + y() * y() + z() * z()).toFixed(2)) ?? 0);
  const accel = createMemo(() => distance() ? parseFloat(((v() * v()) / (2 * distance())).toFixed(3)) ?? 0 : 0);

  // 2. ⚙️ TRẠNG THÁI CƠ THỂ (System & Body State)
  const [battery, setBattery] = createSignal(95);
  const [temp, setTemp] = createSignal(45); // CPU Temp
  const [ram, setRam] = createSignal(48); // RAM %

  const systemEntropy = createMemo(() => {
    const pTemp = temp() / 100, pRam = ram() / 100, pBat = (100 - battery()) / 100;
    const sum = pTemp + pRam + pBat + 0.1;
    const nT = pTemp / sum, nR = pRam / sum, nB = pBat / sum;
    return parseFloat((-(nT * Math.log2(nT) + nR * Math.log2(nR) + nB * Math.log2(nB))).toFixed(3)) ?? 0;
  });

  // 3. ĐỘNG LỰC HỌC & LỰC (Kinetic Force Actuator)
  const [mass, setMass] = createSignal(180); // Khối lượng kg (Ví dụ máy bay/robot nông nghiệp)
  const [appliedAccel, setAppliedAccel] = createSignal(2.5); // Gia tốc m/s^2
  const [friction, setFriction] = createSignal(0.15); // Hệ số ma sát mu

  const force = createMemo(() => parseFloat((mass() * appliedAccel()).toFixed(1)) ?? 0);
  const normalForce = createMemo(() => parseFloat((mass() * 9.81).toFixed(1)) ?? 0);
  const frictionForce = createMemo(() => parseFloat((friction() * normalForce()).toFixed(1)) ?? 0);
  const netForce = createMemo(() => Math.max(0, parseFloat((force() - frictionForce()).toFixed(1))) ?? 0);

  // 4. 🌡️ CẢM BIẾN MÔI TRƯỜNG (Ambient Environment)
  const [soilMoisture, setSoilMoisture] = createSignal(60); // % Độ ẩm đất
  const [ambientTemp, setAmbientTemp] = createSignal(32); // Độ C
  const [light, setLight] = createSignal(750); // Lux cường độ ánh sáng

  const evapotranspiration = createMemo(() => parseFloat((0.0023 * (ambientTemp() + 17.8) * Math.sqrt(light() / 150)).toFixed(3)) ?? 0);

  const [bayesPrior, setBayesPrior] = createSignal(0.15);

  // Load initial brain parameters from API
  createEffect(async () => {
    try {
      const res = await fetch("/api/agent/brain/parameters");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.parameters) {
          const p = data.parameters;
          if (p.x !== undefined) setX(p.x);
          if (p.y !== undefined) setY(p.y);
          if (p.z !== undefined) setZ(p.z);
          if (p.v !== undefined) setV(p.v);
          if (p.battery !== undefined) setBattery(p.battery);
          if (p.temp !== undefined) setTemp(p.temp);
          if (p.ram !== undefined) setRam(p.ram);
          if (p.mass !== undefined) setMass(p.mass);
          if (p.appliedAccel !== undefined) setAppliedAccel(p.appliedAccel);
          if (p.friction !== undefined) setFriction(p.friction);
          if (p.soilMoisture !== undefined) setSoilMoisture(p.soilMoisture);
          if (p.ambientTemp !== undefined) setAmbientTemp(p.ambientTemp);
          if (p.light !== undefined) setLight(p.light);
          if (p.bayesPrior !== undefined) setBayesPrior(p.bayesPrior);
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải tham số não:", err);
    }
  });

  // Debounced synchronization effect to backend parameters
  let syncTimeout: any = null;
  const syncParametersToBackend = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      try {
        await fetch("/api/agent/brain/parameters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            x: x(),
            y: y(),
            z: z(),
            v: v(),
            battery: battery(),
            temp: temp(),
            ram: ram(),
            mass: mass(),
            appliedAccel: appliedAccel(),
            friction: friction(),
            soilMoisture: soilMoisture(),
            ambientTemp: ambientTemp(),
            light: light(),
            bayesPrior: bayesPrior(),
          }),
        });
      } catch (err) {
        console.error("Lỗi đồng bộ tham số lên backend:", err);
      }
    }, 500);
  };

  createEffect(() => {
    x();
    y();
    z();
    v();
    battery();
    temp();
    ram();
    mass();
    appliedAccel();
    friction();
    soilMoisture();
    ambientTemp();
    light();
    bayesPrior();

    if (typeof window !== "undefined") {
      syncParametersToBackend();
    }
  });

  // 5. TERMINAL LOGS
  const [logs, setLogs] = createSignal<string[]>([
    "🚀 [SYSTEM] Khởi tạo Hệ thống Định vị Không gian Bayes...",
    "🔋 [HARDWARE] Trạng thái phần cứng: Tối ưu | Mức sạc: 95%",
    "🌾 [SENSOR] Độ ẩm đất 60% thích hợp cho sự sinh trưởng của Cây lúa F1.",
  ]);

  // 6. 🚚 PHÂN HỆ KIỂM SOÁT VẬN TẢI & LOGISTICS ANPR
  const [bannedPlates, setBannedPlates] = createSignal(["29A-11111", "30K-22222", "51F-33333"]);
  const [inputPlate, setInputPlate] = createSignal("29A-12345");
  const [restrictedHour, setRestrictedHour] = createSignal(false);
  const [hasPermit, setHasPermit] = createSignal(false);
  const [gpsDistance, setGpsDistance] = createSignal(12); // khoảng cách m

  const [scanStatus, setScanStatus] = createSignal("STANDBY"); // STANDBY, BANNED, RESTRICTED, ALLOWED
  const [barrierState, setBarrierState] = createSignal("CLOSED"); // CLOSED, OPEN
  const [scanMessage, setScanMessage] = createSignal("Hệ thống Barie tự động đang chờ nhận diện biển số...");

  // ANPR physical metrics formulas
  const responseTime = createMemo(() => {
    const base = 5.2;
    const tempFactor = temp() * 0.08;
    const distanceFactor = gpsDistance() * 0.15;
    return parseFloat((base + tempFactor + distanceFactor).toFixed(1));
  });

  const aiAccuracy = createMemo(() => {
    const plate = inputPlate().trim();
    if (!plate) return 0;
    const base = 94.5;
    const lightFactor = Math.min(5, (light() / 1500) * 5);
    const tempPenalty = Math.max(0, (temp() - 70) * 0.1);
    return parseFloat(Math.min(99.9, base + lightFactor - tempPenalty).toFixed(2));
  });

  const approachSpeed = createMemo(() => {
    const baseSpeed = v() * 3.6; // m/s to km/h
    const distanceRatio = Math.min(1, gpsDistance() / 15);
    return parseFloat((baseSpeed * distanceRatio).toFixed(1));
  });

  const neuralLoad = createMemo(() => {
    const base = 25;
    const ramFactor = ram() * 0.4;
    const scanActiveFactor = inputPlate().trim() ? 15 : 0;
    return parseFloat(Math.min(100, base + ramFactor + scanActiveFactor).toFixed(1));
  });

  const violationProbability = createMemo(() => {
    const plate = inputPlate().trim().toUpperCase();
    if (!plate) return 0;
    const pV = bayesPrior();
    const pNotV = 1 - pV;
    const isBanned = bannedPlates().includes(plate);
    if (isBanned) return 99.9;

    const isRestrictedAndNoPermit = restrictedHour() && !hasPermit();
    let pSignalGivenV = 0.1;
    let pSignalGivenNotV = 0.1;

    if (isRestrictedAndNoPermit) {
      pSignalGivenV = 0.85;
      pSignalGivenNotV = 0.15;
    } else if (restrictedHour() && hasPermit()) {
      pSignalGivenV = 0.2;
      pSignalGivenNotV = 0.4;
    } else {
      pSignalGivenV = 0.1;
      pSignalGivenNotV = 0.8;
    }

    const numerator = pSignalGivenV * pV;
    const denominator = numerator + pSignalGivenNotV * pNotV;
    const posterior =
      denominator > 0 ? numerator / denominator : 0;
    return parseFloat((posterior * 100).toFixed(1));
  });

  const runAnprAudit = () => {
    const plate = inputPlate().trim().toUpperCase();
    if (!plate) {
      setScanMessage("⚠️ Vui lòng nhập biển số xe cần quét!");
      return;
    }

    // 1. Kiểm tra danh sách cấm
    if (bannedPlates().includes(plate)) {
      setScanStatus("BANNED");
      setBarrierState("CLOSED");
      setScanMessage(`❌ [BANNED] Biển số ${plate} khớp Blacklist! Chốt Barie đóng chặn hoàn toàn.`);
      setLogs(
        (prev) => [
          `⚠️ [ALERT] ANPR phát hiện xe cấm: ${plate} tại cổng phụ nông trại!`,
          `🚧 [BARRIER] Trạng thái: Đóng chặn cứng. Tự động thông báo ban quản trị.`,
          ...prev.slice(0, 3),
        ],
      );
      return;
    }

    // 2. Kiểm tra giờ cấm
    if (restrictedHour() && !hasPermit()) {
      setScanStatus("RESTRICTED");
      setBarrierState("CLOSED");
      setScanMessage(`🚫 [RESTRICTED] Đang khung giờ cấm lưu thông khu vực! Yêu cầu Thẻ/Giấy phép.`);
      setLogs(
        (prev) => [
          `🚫 [WARN] Phát hiện xe ${plate} vi phạm khung giờ cấm vùng đệm sinh thái!`,
          `🎫 [SECURITY] Xe không có thẻ thông hành hợp lệ. Barie giữ nguyên trạng thái đóng.`,
          ...prev.slice(0, 3),
        ],
      );
      return;
    }

    // 3. Kiểm tra khoảng cách định vị GPS
    if (gpsDistance() <= 5) {
      setScanStatus("ALLOWED");
      setBarrierState("OPEN");
      setScanMessage(`🟢 [ALLOWED] Xe ${plate} hợp lệ và đã di chuyển sát Barie (<5m). Barie tự động mở!`);
      setLogs(
        (prev) => [
          `🟢 [ANPR] Quét biển số ${plate} hợp lệ.`,
          `📍 [GPS] Khoảng cách định vị: ${gpsDistance()}m (Đạt ngưỡng tiếp cận <5m).`,
          `🚧 [ACTUATOR] Tín hiệu kích hoạt rơ-le mở Barie thành công!`,
          ...prev.slice(0, 3),
        ],
      );
    } else {
      setScanStatus("ALLOWED");
      setBarrierState("CLOSED");
      setScanMessage(`ℹ️ [STANDBY] Xe ${plate} hợp lệ nhưng còn cách xa chốt (${gpsDistance()}m). Vui lòng di chuyển sát chốt.`);
      setLogs(
        (prev) => [
          `ℹ️ [ANPR] Quét biển số ${plate} hợp lệ.`,
          `📍 [GPS] Khoảng cách định vị: ${gpsDistance()}m (Ngoài phạm vi mở tự động).`,
          `🚧 [STATUS] Chờ xe di chuyển sát chốt để mở Barie.`,
          ...prev.slice(0, 3),
        ],
      );
    }
  };

  const triggerAutoBalance = () => {
    const newLogs = [
      `🔄 [ACTION] Bắt đầu tự động cân bằng hệ thống...`,
      `📍 Vị trí hiện tại: x=${x()}, y=${y()}, z=${z()} | Quãng đường dịch chuyển: ${distance()}m`,
      `⚙️ Trạng thái cơ thể: Pin ${battery()}%, CPU Temp ${temp()}°C | Entropy hệ thống: ${systemEntropy()} bits`,
      `🔥 Tính toán Động lực học: Lực đẩy chủ động F=${force()} N | Lực cản ma sát F_f=${frictionForce()} N`,
      `🌡️ Đo đạc Môi trường: Độ ẩm đất=${soilMoisture()}% | Tốc độ bốc hơi nước ET_0=${evapotranspiration()} mm/ngày`,
      `✅ [BALANCED] Hệ thống đã đạt trạng thái cân bằng nội môi tối ưu (Homeostasis)!`,
    ];
    setLogs(newLogs);
  };

  const [isAutoPilot] = createSignal(typeof window !== "undefined" ? localStorage.getItem("autoPilotEnabled") === "true" : false);
  const [isAutoBalance] = createSignal(typeof window !== "undefined" ? localStorage.getItem("autoBalanceEnabled") === "true" : false);

  let timer: any = null;
  let approachTimer: any = null;
  let balanceTimer: any = null;
  let waveIndex = 0;

  // Auto ANPR audit on input changes
  createEffect(() => {
    runAnprAudit();
  });

  // Background Homeostasis (Auto Balance) Loop
  createEffect(() => {
    if (isAutoBalance()) {
      balanceTimer = setInterval(() => {
        // Gently pull back toward baseline values
        setBattery((prev) => prev < 95 ? Math.min(95, prev + 1) : Math.max(95, prev - 1));
        setTemp((prev) => prev < 45 ? Math.min(45, prev + 1) : Math.max(45, prev - 1));
        setRam((prev) => prev < 48 ? Math.min(48, prev + 1) : Math.max(48, prev - 1));
        setSoilMoisture((prev) => prev < 60 ? Math.min(60, prev + 1) : Math.max(60, prev - 1));
        setAmbientTemp((prev) => prev < 32 ? Math.min(32, prev + 1) : Math.max(32, prev - 1));
        setLight((prev) => prev < 750 ? Math.min(750, prev + 10) : Math.max(750, prev - 10));

        if (Math.random() > 0.8) {
          setLogs(
            (prev) => [
              `⚖️ [HOMEOSTASIS] Cân bằng nội môi đang diễn ra (Nhiệt độ CPU: ${temp()}°C, Độ ẩm đất: ${soilMoisture()}%)`,
              ...prev.slice(0, 3),
            ],
          );
        }
      }, 3000);
    } else {
      clearInterval(balanceTimer);
    }
  });

  createEffect(() => {
    if (isAutoPilot()) {
      // 1. Fluctuating sensors (wave cycle)
      timer = setInterval(() => {
        waveIndex += 0.2;

        // 📍 Vị trí
        setX(Math.round(25 + Math.sin(waveIndex) * 15));
        setY(Math.round(25 + Math.cos(waveIndex * 0.8) * 15));
        setZ(Math.round(10 + Math.sin(waveIndex * 1.5) * 8));
        setV(parseFloat((5 + Math.cos(waveIndex) * 3).toFixed(1)));

        // ⚙️ Trạng thái cơ thể (Only fluctuate if Auto Balance is not active, or fluctuate less)
        if (!isAutoBalance()) {
          setBattery((prev) => Math.max(10, prev <= 15 ? 100 : prev - 1));
          setTemp(Math.round(45 + Math.sin(waveIndex) * 15));
          setRam(Math.round(48 + Math.cos(waveIndex * 1.2) * 20));

          // 🌡️ Môi trường
          setSoilMoisture(Math.round(60 + Math.sin(waveIndex * 0.5) * 15));
          setAmbientTemp(Math.round(30 + Math.cos(waveIndex * 0.4) * 8));
          setLight(Math.round(800 + Math.sin(waveIndex * 0.7) * 400));
        } else {
          // Fluctuates very gently since Homeostasis counteracts it
          setBattery((prev) => Math.max(10, prev <= 15 ? 100 : prev - 0.2));
          setTemp(Math.round(45 + Math.sin(waveIndex) * 3));
          setRam(Math.round(48 + Math.cos(waveIndex * 1.2) * 4));
          setSoilMoisture(Math.round(60 + Math.sin(waveIndex * 0.5) * 3));
          setAmbientTemp(Math.round(32 + Math.cos(waveIndex * 0.4) * 1.5));
          setLight(Math.round(750 + Math.sin(waveIndex * 0.7) * 60));
        }

        // 🔥 Lực
        setAppliedAccel(parseFloat((2.5 + Math.sin(waveIndex * 2) * 1.5).toFixed(1)));
      }, 2000);

      // 2. Automating vehicle arrivals at the gate
      let carState = 0; // 0: approaching, 1: at gate, 2: passing, 3: resetting
      const plates = ["29A-11111", "30K-22222", "51F-33333", "29A-88888", "30H-99999", "15A-77777"];

      approachTimer = setInterval(() => {
        if (carState === 0) {
          const randomPlate = plates[Math.floor(Math.random() * plates.length)];
          setInputPlate(randomPlate);
          setRestrictedHour(Math.random() > 0.7);
          setHasPermit(Math.random() > 0.5);
          setGpsDistance(15);
          carState = 1;
        } else if (carState === 1) {
          setGpsDistance(8);
          carState = 2;
        } else if (carState === 2) {
          setGpsDistance(3);
          carState = 3;
        } else if (carState === 3) {
          setGpsDistance(25);
          carState = 0;
        }
      }, 3000);
    } else {
      clearInterval(timer);
      clearInterval(approachTimer);
    }
  });

  onCleanup(() => {
    clearInterval(timer);
    clearInterval(approachTimer);
    clearInterval(balanceTimer);
  });

  <div
    class={`p-6 md:p-8 rounded-3xl border shadow-lg mt-6 w-full max-w-6xl transition-all duration-300 animate-in fade-in zoom-in-95 ${
      theme() === "dark" ? "bg-[#0f0f0f] border-white/10 text-white" : "bg-white border-gray-100 text-gray-800"
    }`}>
    {/* Header */}
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-500/10 pb-6 mb-8 gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 bg-green-500 rounded-full animate-ping" />
          <span
            class="text-[10px] font-bold text-green-500 uppercase tracking-widest bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
            {"Live Math Engine Connected"}
          </span>
        </div>
        <h3 class={`font-black text-2xl tracking-tight mt-2 ${theme() === "dark" ? "text-white" : "text-gray-900"}`}>
          {"BẢNG ĐIỀU KHIỂN TOÁN HÓA TÁC NHÂN"}
        </h3>
        <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
          {"Mathematical Control Panel: Vị Trí, Trạng Thái, Lực & Môi Trường"}
        </p>
      </div>
    </div>

    {/* Main Grid: 4 Pillars */}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* 1. VỊ TRÍ & ĐỊNH VỊ (GPS & SLAM) */}
      <div
        class={`p-6 rounded-2xl border backdrop-blur-md transition-all ${
          theme() === "dark" ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200"
        }`}>
        <div class="flex items-center gap-3 mb-6">
          <Icon path={mapPin} class="w-8 h-8 text-blue-500" />
          <div>
            <h4 class="font-black text-base">{"1. Vị Trí & Định Vị Không Gian"}</h4>
            <span class="text-[9px] font-bold text-blue-500 uppercase tracking-wider">{"SLAM / Vector Coordinates"}</span>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Tọa độ X (x):"}</span>
              <span class="text-blue-500 font-mono">{`${x()} m`}</span>
            </label>
            <input
              type="range"
              min="0"
              max="50"
              value={x()}
              onInput={(e) => setX(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Tọa độ Y (y):"}</span>
              <span class="text-blue-500 font-mono">{`${y()} m`}</span>
            </label>
            <input
              type="range"
              min="0"
              max="50"
              value={y()}
              onInput={(e) => setY(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Độ cao Z (z):"}</span>
              <span class="text-blue-500 font-mono">{`${z()} m`}</span>
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={z()}
              onInput={(e) => setZ(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Vận tốc dịch chuyển (v):"}</span>
              <span class="text-blue-500 font-mono">{`${v()} m/s`}</span>
            </label>
            <input
              type="range"
              min="1"
              max="15"
              step="0.5"
              value={v()}
              onInput={(e) => setV(parseFloat(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        {/* Toán hóa */}
        <div class="mt-6 p-4 rounded-xl bg-black/20 border border-white/5 text-xs font-mono space-y-2">
          <p class="text-blue-400">{"THỐNG KÊ ĐỘNG HỌC (KINEMATICS):"}</p>
          <p>{`Vector vị trí: p = [${x()}, ${y()}, ${z()}]^T`}</p>
          <p>{`Quãng đường đến gốc O: d = sqrt(x² + y² + z²) = ${distance()} m`}</p>
          <p class="text-yellow-400">{`Gia tốc phản lực: a = v² / 2d = ${accel()} m/s²`}</p>
        </div>
      </div>

      <div
        class={`p-6 rounded-2xl border backdrop-blur-md transition-all ${
          theme() === "dark" ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200"
        }`}>
        <div class="flex items-center gap-3 mb-6">
          <Icon path={adjustmentsHorizontal} class="w-8 h-8 text-purple-500" />
          <div>
            <h4 class="font-black text-base">{"2. Trạng Thái Hệ Thống Nội Tại"}</h4>
            <span class="text-[9px] font-bold text-purple-500 uppercase tracking-wider">{"Hardware Health & Homeostasis"}</span>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Dung lượng Pin (E_battery):"}</span>
              <span class="text-purple-500 font-mono">{`${battery()}%`}</span>
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={battery()}
              onInput={(e) => setBattery(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>

          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Nhiệt độ CPU (T_cpu):"}</span>
              <span class="text-purple-500 font-mono">{`${temp()} °C`}</span>
            </label>
            <input
              type="range"
              min="30"
              max="95"
              value={temp()}
              onInput={(e) => setTemp(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>

          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Tải lượng RAM (M_ram):"}</span>
              <span class="text-purple-500 font-mono">{`${ram()}%`}</span>
            </label>
            <input
              type="range"
              min="10"
              max="95"
              value={ram()}
              onInput={(e) => setRam(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>
        </div>

        {/* Toán hóa */}
        <div class="mt-12 p-4 rounded-xl bg-black/20 border border-white/5 text-xs font-mono space-y-2">
          <p class="text-purple-400">{"🧬 NHẬN THỨC NĂNG LƯỢNG NỘI TẠI:"}</p>
          <p>{`Hardware Vector: s = [Pin: ${battery()}%, CPU: ${temp()}°C, RAM: ${ram()}%]^T`}</p>
          <p class="text-yellow-400">{`System Entropy (Shannon): H_sys = -Σ p_i log2(p_i) = ${systemEntropy()} bits`}</p>
          <p class="text-[10px] text-gray-400">{"*Entropy thấp biểu hiện hệ thống hoạt động ổn định lý tưởng."}</p>
        </div>
      </div>

      {/* 3. ĐỘNG LỰC HỌC & LỰC (KINETICS & FORCES) */}
      <div
        class={`p-6 rounded-2xl border backdrop-blur-md transition-all ${
          theme() === "dark" ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200"
        }`}>
        <div class="flex items-center gap-3 mb-6">
          <Icon path={fire} class="w-6 h-6 text-gray-600" />
          <div>
            <h4 class="font-black text-base">{"3. Động Lực Học Cơ Học"}</h4>
            <span class="text-[9px] font-bold text-amber-500 uppercase tracking-wider">{"Applied Forces & Kinetics"}</span>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Khối lượng Agent (m):"}</span>
              <span class="text-amber-500 font-mono">{`${mass()} kg`}</span>
            </label>
            <input
              type="range"
              min="10"
              max="500"
              value={mass()}
              onInput={(e) => setMass(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
          </div>

          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Gia tốc đẩy (a_applied):"}</span>
              <span class="text-amber-500 font-mono">{`${appliedAccel()} m/s²`}</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={appliedAccel()}
              onInput={(e) => setAppliedAccel(parseFloat(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
          </div>

          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Hệ số ma sát đường bộ (μ):"}</span>
              <span class="text-amber-500 font-mono">{friction()}</span>
            </label>
            <input
              type="range"
              min="0.01"
              max="0.8"
              step="0.01"
              value={friction()}
              onInput={(e) => setFriction(parseFloat(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
          </div>
        </div>

        {/* Toán hóa */}
        <div class="mt-6 p-4 rounded-xl bg-black/20 border border-white/5 text-xs font-mono space-y-2">
          <p class="text-amber-400">{"⚙️ CƠ HỌC NEWTON (DYNAMICS):"}</p>
          <p>{`Lực đẩy chủ động: F = m * a = ${force()} N (Newton)`}</p>
          <p>{`Lực phản xạ mặt đất: N = m * g = ${normalForce()} N`}</p>
          <p>{`Lực ma sát cản: F_friction = μ * N = ${frictionForce()} N`}</p>
          <p class="text-yellow-400">{`Lực đẩy hiệu dụng: F_net = F - F_friction = ${netForce()} N`}</p>
        </div>
      </div>

      {/* 4. 🌡️ CẢM BIẾN MÔI TRƯỜNG NÔNG NGHIỆP */}
      <div
        class={`p-6 rounded-2xl border backdrop-blur-md transition-all ${
          theme() === "dark" ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200"
        }`}>
        <div class="flex items-center gap-3 mb-6">
          <span class="text-2xl">{"🌡️"}</span>
          <div>
            <h4 class="font-black text-base">{"4. Cảm Biến Sinh Thái Môi Môi Trường"}</h4>
            <span class="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">{"Agriculture Sensors & Microclimate"}</span>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Độ ẩm Đất (H_soil):"}</span>
              <span class="text-emerald-500 font-mono">{`${soilMoisture()}%`}</span>
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={soilMoisture()}
              onInput={(e) => setSoilMoisture(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>

          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Nhiệt độ Môi trường (T_ambient):"}</span>
              <span class="text-emerald-500 font-mono">{`${ambientTemp()} °C`}</span>
            </label>
            <input
              type="range"
              min="15"
              max="45"
              value={ambientTemp()}
              onInput={(e) => setAmbientTemp(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>

          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Cường độ Ánh sáng (L_lux):"}</span>
              <span class="text-emerald-500 font-mono">{`${light()} Lux`}</span>
            </label>
            <input
              type="range"
              min="100"
              max="1500"
              step="50"
              value={light()}
              onInput={(e) => setLight(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>
        </div>

        {/* Toán hóa */}
        <div class="mt-6 p-4 rounded-xl bg-black/20 border border-white/5 text-xs font-mono space-y-2">
          <p class="text-emerald-400">{"🌱 SINH THÁI HỌC THỰC VẬT (ECOLOGY):"}</p>
          <p>{`Độ ẩm đất hiện trạng: H_soil = ${soilMoisture()}% (Tối ưu: 60-80%)`}</p>
          <p>{`Cường độ bức xạ quy đổi: R_solar = ${parseFloat((light() / 150).toFixed(2))} MJ/m²`}</p>
          <p class="text-yellow-400">{`Tốc độ bốc thoát hơi nước: ET_0 = ${evapotranspiration()} mm/ngày`}</p>
          <p class="text-[10px] text-gray-400">{"*(Công thức Hargreaves định lượng dòng bốc thoát hơi nước nông nghiệp)"}</p>
        </div>
      </div>
    </div>

    {/* 5. 🚚 PHÂN HỆ KIỂM SOÁT VẬN TẢI & LOGISTICS ANPR (ASCII Flow Simulation) */}
    <div
      class={`p-6 rounded-2xl border mb-8 backdrop-blur-md transition-all ${
        theme() === "dark" ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200"
      }`}>
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-500/10 pb-4 mb-6 gap-4">
        <div class="flex items-center gap-3">
          <Icon path={truck} class="w-6 h-6 text-gray-600" />
          <div>
            <h4 class="font-black text-base">{"5. Phân Hệ Kiểm Soát Vận Tải & Logistics Xe ANPR"}</h4>
            <span class="text-[9px] font-bold text-blue-500 uppercase tracking-wider">{"Digital Access Control & Barrier Actuator"}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class={`w-2.5 h-2.5 rounded-full ${barrierState() === "OPEN" ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <span
            class={`text-[10px] font-bold px-2 py-1 rounded-full border ${
              barrierState() === "OPEN"
                ? "text-green-500 bg-green-500/10 border-green-500/20"
                : "text-red-500 bg-red-500/10 border-red-500/20"
            }`}>
            {`BARRIER STATE: ${barrierState()}`}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Controls Column */}
        <div class="space-y-4 md:col-span-1">
          <div>
            <label class="block text-xs font-bold mb-1">{"Biển số xe quét ANPR:"}</label>
            <div class="flex gap-2">
              <input
                type="text"
                value={inputPlate()}
                onInput={(e) => setInputPlate(e.target.value)}
                class={`flex-1 px-3 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-blue-100 outline-none ${
                  theme() === "dark" ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-800"
                }`}
                placeholder="Nhập biển số..."
              />
              <button
                onClick={runAnprAudit}
                class="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors">
                {"Quét"}
              </button>
            </div>
            <p class="text-[10px] text-gray-400 mt-1">{"Blacklist cấm: 29A-11111, 30K-22222, 51F-33333"}</p>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs font-bold">{"Đang khung giờ cấm vùng đệm:"}</span>
            <button
              onClick={() => setRestrictedHour(!restrictedHour())}
              class={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                restrictedHour() ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-gray-500/10 border-gray-500/20 text-gray-400"
              }`}>
              {restrictedHour() ? "ĐỒNG Ý (CẤM)" : "BÌNH THƯỜNG"}
            </button>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs font-bold">{"Sở hữu thẻ xe được phép:"}</span>
            <button
              onClick={() => setHasPermit(!hasPermit())}
              class={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                hasPermit() ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-gray-500/10 border-gray-500/20 text-gray-400"
              }`}>
              {hasPermit() ? "CÓ GIẤY PHÉP" : "KHÔNG CÓ"}
            </button>
          </div>

          <div>
            <label class="flex justify-between text-xs font-bold mb-1">
              <span>{"Khoảng cách định vị GPS:"}</span>
              <span class="text-blue-500 font-mono">{`${gpsDistance()} m`}</span>
            </label>
            <input
              type="range"
              min="1"
              max="30"
              value={gpsDistance()}
              onInput={(e) => setGpsDistance(parseInt(e.target.value))}
              class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <p class="text-[9px] text-gray-400">{"*Hệ thống tự động mở Barie khi xe hợp lệ ở khoảng cách <= 5 mét."}</p>
          </div>
        </div>

        {/* Live Status and ASCII Drawing Column */}
        <div class="md:col-span-2 space-y-4">
          {/* Status Alert Box */}
          <div
            class={`p-4 rounded-xl border font-bold text-sm ${
              scanStatus() === "BANNED"
                ? "bg-red-500/10 border-red-500/20 text-red-500"
                : scanStatus() === "RESTRICTED"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                  : scanStatus() === "ALLOWED" && barrierState() === "OPEN"
                    ? "bg-green-500/10 border-green-500/20 text-green-500"
                    : "bg-gray-500/10 border-gray-500/20 text-gray-400"
            }`}>
            {scanMessage()}
          </div>

          {/* Real-time Telemetry & Metrics Dashboard */}
          <div
            class={`p-5 rounded-xl border grid grid-cols-2 md:grid-cols-4 gap-4 shadow-inner ${
              theme() === "dark" ? "bg-black/30 border-white/5" : "bg-gray-50 border-gray-100"
            }`}>
            <div class={`p-3 rounded-lg border ${theme() === "dark" ? "bg-[#111] border-gray-800" : "bg-white border-gray-200"}`}>
              <span class="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">{"Đo lường Phản hồi"}</span>
              <span class="text-lg font-mono text-blue-500">
                {responseTime()}
                {" ms"}
              </span>
              <span class="text-[9px] text-gray-400 block mt-1">{"Độ trễ Sensor thực"}</span>
            </div>
            <div
              class={`p-3 rounded-lg border flex flex-col justify-between ${
                theme() === "dark" ? "bg-[#111] border-gray-800" : "bg-white border-gray-200"
              }`}>
              <span class="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">{"Biển số nhận diện"}</span>
              <span class={`text-lg font-mono font-bold ${scanStatus() === "BANNED" ? "text-red-500" : "text-green-500"}`}>
                {inputPlate().trim() || "TRỐNG"}
              </span>
              <span class="text-[9px] text-gray-400 block mt-1">
                {"Độ chính xác AI: "}
                {aiAccuracy().toFixed(2)}
                {"%"}
              </span>
            </div>
            <div
              class={`p-3 rounded-lg border flex flex-col justify-between ${
                theme() === "dark" ? "bg-[#111] border-gray-800" : "bg-white border-gray-200"
              }`}>
              <span class="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">{"Tọa độ Vector GPS"}</span>
              <span class="text-sm font-mono text-fuchsia-500 block font-bold">
                {"Δ = "}
                {gpsDistance()}
                {" m"}
              </span>
              <span class="text-[9px] text-gray-400 block mt-1">
                {"Vận tốc tiếp cận: "}
                {approachSpeed()}
                {" km/h"}
              </span>
            </div>
            <div
              class={`p-3 rounded-lg border flex flex-col justify-between ${
                theme() === "dark" ? "bg-[#111] border-gray-800" : "bg-white border-gray-200"
              }`}>
              <span class="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">{"Xác suất vi phạm"}</span>
              <span
                class={`text-lg font-mono font-bold ${
                  violationProbability() > 50 ? (violationProbability() > 90 ? "text-red-500" : "text-amber-500") : "text-green-500"
                }`}>
                {violationProbability()}
                {"%"}
              </span>
              <span class="text-[9px] text-gray-400 block mt-1">{"Thuật toán: Bayes Theorem"}</span>
            </div>
            <div class="col-span-2 md:col-span-4 mt-2">
              <div class="flex justify-between text-[10px] font-bold mb-1.5 uppercase tracking-wider text-gray-500">
                <span>{"Tải trọng mạng Neural ANPR (Real-time GPU VRAM)"}</span>
                <span class="text-blue-500">
                  {neuralLoad()}
                  {"%"}
                </span>
              </div>
              <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${neuralLoad()}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* 6. HỆ CHUYÊN GIA TOÁN HỌC & GRAPH RAG CORE */}
    <div
      class={`p-6 rounded-2xl border mb-8 backdrop-blur-md transition-all ${
        theme() === "dark" ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200"
      }`}>
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-500/10 pb-4 mb-6 gap-4">
        <div class="flex items-center gap-3">
          <Icon path={puzzlePiece} class="w-6 h-6 text-gray-600" />
          <div>
            <h4 class="font-black text-base">{"6. Hệ Chuyên Gia Toán Học & Lõi Graph RAG"}</h4>
            <span class="text-[9px] font-bold text-fuchsia-500 uppercase tracking-wider">
              {"Academic Mathematics & Expert Reasoning Engine"}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-fuchsia-500 rounded-full animate-pulse" />
          <span class="text-[10px] font-bold px-2 py-1 rounded-full border text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20">
            {"SYNCED TO HIPPOCAMPUS"}
          </span>
        </div>
      </div>

      <tsx>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!mathData() || mathData().length === 0
            ? <div class="text-xs text-gray-500 animate-pulse col-span-3">Đang tải dữ liệu Toán học từ CSDL SQL...</div>
            : (mathData().map(
                (node: any) => <div
                  class={`p-4 rounded-xl border flex gap-3 ${
                    theme() === "dark"
                      ? "bg-black/30 border-white/5 hover:border-fuchsia-500/30"
                      : "bg-white border-gray-200 hover:border-fuchsia-500/30"
                  } transition-colors cursor-default`}>
                  <span class="text-xl">
                    {"📐"}
                  </span>
                  <div>
                    <h5 class="text-xs font-bold">
                      {node.title}
                    </h5>
                    <p class="text-[10px] text-gray-500 mt-1 line-clamp-2">
                      {node.explanation}
                    </p>
                  </div>
                </div>,
              ))}
        </div>
      </tsx>

      <div class="mt-6 p-4 rounded-xl bg-black/20 border border-white/5 text-xs font-mono space-y-2">
        <p class="text-fuchsia-400">{"🔗 GRAPH RAG STATUS:"}</p>
        <p>{"Dữ liệu đã được băm nhỏ (Embedding) và tạo liên kết chéo (Pointers)."}</p>
        <p>{"Sẵn sàng gọi hàm hybridRetrieve đệ quy đa tầng khi kích hoạt NLP Agent."}</p>
      </div>
    </div>

    {/* Live Mathematical Terminal Output */}
    <div class="mt-6 border-t border-gray-500/10 pt-6">
      <h4 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
        {"Trạm phân tích Vector Bayes & Động học thời gian thực"}
      </h4>
      <div
        class={`p-6 rounded-2xl border font-mono text-xs md:text-sm shadow-inner relative overflow-hidden ${
          theme() === "dark" ? "bg-black/50 border-white/5 text-gray-300" : "bg-gray-100 border-gray-200 text-gray-700"
        }`}>
        <div class="absolute top-3 right-3 flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
          <span class="text-[9px] font-bold text-green-500 uppercase tracking-wider">{"Live Shell"}</span>
        </div>
        <tsx>
          <ul class="space-y-2">
            {logs().map(
              (log: string) => <li class="flex gap-2">
                <span class="text-blue-500">
                  {"$"}
                </span>
                <span>{log}</span>
              </li>,
            )}
          </ul>
        </tsx>
      </div>
    </div>
  </div>
}
