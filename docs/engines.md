# Bộ đọc âm thanh trong Kiwi Text to Speech

Tài liệu kỹ thuật tóm tắt về kiến trúc âm thanh, các máy chủ giọng nói được hỗ trợ và cách tích hợp thêm máy chủ mới.

## 1. Kiến trúc hai tầng

Extension hoạt động theo chuẩn Chrome Manifest V3:
- **Giọng hệ thống (`chrome.tts`)**: Gọi trực tiếp từ service worker qua Web Speech API có sẵn trong trình duyệt (Microsoft An, David, Google US/UK...). Dùng được ngay, không cần cài đặt thêm.
- **Giọng AI cục bộ (Local Server)**: Do service worker không có `AudioContext`, extension chuyển việc tải và phát âm thanh sang **offscreen document**. Luồng âm thanh được tải trước và phát liên tục, không bị khựng giữa các đoạn câu.

## 2. Chuẩn kết nối máy chủ (OpenAI Speech API)

Mọi máy chủ giọng nói tích hợp vào extension đều giao tiếp theo chuẩn OpenAI speech:

```http
POST {baseUrl}/v1/audio/speech
Content-Type: application/json
{
  "model": "tên-mô-hình",
  "input": "văn bản cần đọc",
  "voice": "tên-giọng",
  "response_format": "wav"
}
-> Trả về: audio binary (audio/wav hoặc audio/pcm)

GET {baseUrl}/v1/voices
-> Trả về: danh sách giọng (mảng chuỗi hoặc { "data": [{ "name": ..., "lang": ... }] })
```

*Lưu ý*: Tốc độ đọc (`speed`) được điều chỉnh linh hoạt bằng `playbackRate` của thẻ audio tại offscreen document để đảm bảo tương thích mọi máy chủ. Khóa truy cập (nếu có) được gửi qua header `Authorization: Bearer <token>` lấy từ `chrome.storage`.

## 3. Cài đặt các máy chủ giọng nói

### VieNeu-TTS (Khuyên dùng cho tiếng Việt - Cổng 8000)
Mô hình v3 Turbo chất lượng cao (48kHz), độ trễ thấp:
```bash
git clone https://github.com/pnnbao97/VieNeu-TTS.git
cd VieNeu-TTS
uv sync
uv run python -m apps.openai_speech
```
*Mẹo trên Windows*: Khi đặt thư mục `VieNeu-TTS` cùng cấp với thư mục `kiwi-text2speech`, bạn chỉ cần chạy file `tools/start_tts.bat` trong extension.

### VietTTS (Lựa chọn thêm - Cổng 8298)
```bash
git clone https://github.com/dangvansam/viet-tts.git
cd viet-tts
pip install -e .
viettts server --port 8298
```

Kiểm tra nhanh máy chủ bằng dòng lệnh:
```bash
node -e "require('http').get('http://127.0.0.1:8000/v1/voices', r => r.pipe(process.stdout))"
```

## 4. Cơ chế nhận diện và mở rộng

- **Dò tìm tự động**: Mỗi khi mở popup, extension gửi tín hiệu kiểm tra tới các cổng máy chủ đã khai (thời gian chờ tối đa 2 giây). Nếu máy chủ đang chạy, danh sách giọng sẽ tự động nạp. Nếu chưa chạy, popup sẽ hiển thị câu nhắc kèm lệnh chạy thay vì báo lỗi mạng.
- **Thêm máy chủ mới**: Khai báo một mục mới vào mảng `SERVER_PRESETS` trong `src/kt_voices.js` gồm `id`, `label`, `baseUrl`, `model`, `sampleRate`, `voices` và `run`.
