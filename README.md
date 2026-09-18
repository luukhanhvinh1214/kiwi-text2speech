# Kiwi Text to Speech

Extension Chrome đọc thành tiếng đoạn văn bản bạn chọn trên trang web.

Bôi đen chữ trên trang rồi mở extension, hoặc gõ thẳng vào ô văn bản. Chọn giọng, chỉnh tốc độ, tạm dừng và tiếp tục ngay trong popup. Có nút đổi nền sáng tối.

Chuột phải vào đoạn đã bôi đen cũng đọc được. Phím tắt: `Alt+S` đọc, `Alt+X` dừng.

## Cài

**Nếu bạn dùng git:**

```
git clone https://github.com/luukhanhvinh1214/kiwi-text2speech.git
```

**Nếu bạn không dùng git:** tải thư mục ở đây rồi giải nén.

https://drive.google.com/drive/folders/1MsxgSmInAK9RLiVXIwOVCnTptzJl7tki?usp=sharing

Sau đó, trong Chrome:

1. Mở `chrome://extensions`
2. Bật **Developer mode** ở góc trên bên phải
3. Bấm **Load unpacked**, trỏ vào thư mục vừa tải về

## Giọng đọc

**Giọng trên máy** dùng được ngay, không cần cài thêm: Microsoft An, David, Mark, Zira, Google UK English, Google US English. Máy có giọng nào thì hiện giọng đó. Có Microsoft An thì lấy làm mặc định vì đây là giọng tiếng Việt duy nhất trong nhóm.

**Giọng tiếng Việt qua máy chủ trên máy** nghe tự nhiên hơn, đổi lại phải tự chạy máy chủ:

| Máy chủ | Địa chỉ | Lệnh chạy |
|---|---|---|
| VieNeu-TTS v3 Turbo | 127.0.0.1:8000 | `uv run python -m apps.openai_speech` |

Chưa chạy máy chủ thì popup hiện sẵn lệnh để bạn sao chép. Chạy xong, mở lại popup là thấy đủ giọng.

Cách cài máy chủ và lý do chọn: [docs/chon-bo-doc.md](docs/chon-bo-doc.md).
