# Kiwi Text to Speech

Extension trình duyệt chuyển văn bản thành âm thanh.

Bôi đen một đoạn văn bản trên trang web hoặc nhập trực tiếp vào extension, sau đó nghe nội dung đó được đọc lên. Người dùng có thể chọn giọng đọc, chỉnh tốc độ và tạm dừng hay tiếp tục bất cứ lúc nào.

## Cài

Mở `chrome://extensions`, bật Developer mode, chọn Load unpacked rồi trỏ vào thư mục này.

## Chọn giọng

Cả phần điều khiển lẫn phần chọn giọng đều nằm trong popup, không có trang cài
đặt riêng. Danh sách giọng chia thành hai loại.

**Giọng trên máy** dùng được ngay, không cần cài gì: Microsoft An, David, Mark,
Zira và giọng Google UK English, Google US English. Máy nào có giọng nào thì
hiện giọng đó. Có Microsoft An thì extension lấy giọng này làm mặc định, vì đây
là giọng tiếng Việt duy nhất trong nhóm.

**Giọng tiếng Việt qua máy chủ trên máy** nghe tự nhiên hơn nhiều, đổi lại phải
tự chạy máy chủ. Extension khai sẵn ba máy chủ:

| Máy chủ | Địa chỉ | Lệnh chạy |
|---|---|---|
| VieNeu-TTS v3 Turbo | 127.0.0.1:8000 | `uv run python -m apps.openai_speech` |
| VietTTS | 127.0.0.1:8298 | `viettts server --port 8298` |
| ZeroTTS | 127.0.0.1:8001 | `python tools/zerotts_server.py` |

Máy chủ nào chưa chạy thì popup ghi rõ tên và lệnh chạy của máy chủ đó. Chạy
xong, mở lại popup là thấy đủ giọng, kể cả giọng bạn tự nhân bản thêm.

Cách cài từng máy chủ và lý do chọn đúng ba cái này: [docs/chon-bo-doc.md](docs/chon-bo-doc.md).
