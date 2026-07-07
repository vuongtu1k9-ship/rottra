// =========================================================================
// ROTTRA OFFLINE KNOWLEDGE DOCKING
// Đã tháo bỏ 100% các lệnh fetch gọi API bên ngoài (Wikipedia, Weatherstack, v.v.)
// Hoạt động hoàn toàn Offline bằng các dữ liệu giả lập (Mock Data) nội bộ.
// =========================================================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cached<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
  const cache = new Map<string, { value: T; expiry: number }>();
  return (...args: any[]) => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const entry = cache.get(key);
    if (entry && now < entry.expiry) return entry.value;
    const value = fn(...args);
    cache.set(key, { value, expiry: now + CACHE_TTL });
    return value;
  };
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export const fetchWikipediaSummary = async (title: string): Promise<string | null> => {
  return `[Offline Knowledge] Dữ liệu tham khảo nội bộ cho từ khóa "${title}": Đây là thông tin được giả lập từ bộ não Rottra AI vì hệ thống đang chạy ở chế độ bảo mật ngoại tuyến (100% Offline).`;
};

export const fetchWikidataEntity = async (searchQuery: string): Promise<any | null> => {
  return {
    id: "Q_OFFLINE",
    label: searchQuery,
    description: "Thực thể tri thức được sinh bởi Rottra AI Offline.",
  };
};

export const fetchGoogleBooks = async (topic: string): Promise<any | null> => {
  return [
    {
      title: "Cẩm nang Nông nghiệp Thông minh Rottra",
      author: "Giáo sư AI Rottra",
      description: "Tài liệu lưu trữ nội bộ về cách ứng dụng AI và công nghệ vào tối ưu hóa giá nông sản.",
      year: new Date().getFullYear().toString(),
    }
  ];
};

const weathers = [
  "Nắng đẹp, 32°C, độ ẩm 65%. Thích hợp phơi nông sản.",
  "Trời râm mát, 28°C, độ ẩm 70%. Rất tốt cho cây trồng phát triển.",
  "Có mưa rào nhẹ, 26°C, độ ẩm 85%. Chú ý bảo quản kho bãi khỏi ẩm mốc.",
  "Khô hanh, 34°C, độ ẩm 50%. Cần tăng cường tưới tiêu.",
];

export const fetchWeatherstack = cached(async (location: string): Promise<string | null> => {
  const timeSlot = Math.floor(Date.now() / CACHE_TTL);
  const idx = Math.floor(seededRandom(timeSlot + location.length) * weathers.length);
  return `[Mock Weather] Giả lập thời tiết tại ${location}: ${weathers[idx]}`;
});

export const searchDuckDuckGo = async (query: string): Promise<{ abstract: string; relatedTopics: string[]; url: string } | null> => {
  return {
    abstract: `Kết quả tìm kiếm nội bộ cho "${query}": Không có kết nối mạng. Rottra AI đang hoạt động độc lập.`,
    relatedTopics: ["Nông nghiệp số", "Thương mại điện tử", "Bảo mật AI"],
    url: "https://rottra.vn/offline",
  };
};

export const searchWikipedia = async (
  query: string,
  lang: string = "vi",
): Promise<Array<{ title: string; snippet: string; url: string }> | null> => {
  return [
    {
      title: `Bài viết về ${query}`,
      snippet: `Trích lục nội bộ từ kho tri thức Offline của Rottra về chủ đề ${query}...`,
      url: `https://rottra.vn/wiki-offline`,
    }
  ];
};

export const fetchWiktionary = async (word: string, lang: string = "vi"): Promise<string | null> => {
  return `[Từ điển Offline] "${word}": Một khái niệm được định nghĩa theo hệ thống Rottra Core.`;
};

export const fetchCurrencyFreaks = cached(async (symbols = "VND,USD,EUR"): Promise<string | null> => {
  const timeSlot = Math.floor(Date.now() / CACHE_TTL);
  const usdToVnd = 25400 + Math.floor((seededRandom(timeSlot + 1) - 0.5) * 200);
  const eurToVnd = 27500 + Math.floor((seededRandom(timeSlot + 2) - 0.5) * 200);
  return `[Mock Currency] Tỷ giá nội bộ: 1 USD = ${usdToVnd.toLocaleString()} VND | 1 EUR = ${eurToVnd.toLocaleString()} VND. Cập nhật offline bởi hệ thống Rottra.`;
});
