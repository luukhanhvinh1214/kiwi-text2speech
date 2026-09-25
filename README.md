# Kiwi Text to Speech

Extension đọc văn bản thành tiếng cho Chrome do **Vinhdeptrai** xây dựng.

Mọi thứ chạy trên máy bạn, an toàn, bảo mật, không thu thập dữ liệu duyệt web.

## Chức năng

- Đọc chữ bôi đen trên trang web qua nút loa nổi hoặc menu chuột phải.
- Dịch nhanh đoạn bôi đen và đọc bản dịch ngay trên thẻ nổi tại trang.
- Nhập hoặc dán văn bản trực tiếp vào popup để nghe. Có nút mở rộng toàn màn hình để dễ đọc các đoạn văn dài.
- Tab Dịch riêng trong popup: tự nhận diện ngôn ngữ nguồn, dịch sang tiếng Việt và tự chọn giọng đọc phù hợp cho từng ngôn ngữ.

## Cài đặt

### 1. Cài đặt các thư mục máy chủ giọng nói (Voice Engines)

Để nghe giọng AI tiếng Việt tự nhiên chạy offline trên máy, bạn cần dựng một máy chủ giọng nói. Khuyên dùng đặt thư mục máy chủ cùng cấp với thư mục extension:

```text
Thư mục làm việc/
├── kiwi-text2speech/      # Thư mục extension Chrome
└── VieNeu-TTS/            # Thư mục máy chủ giọng nói AI
```

- **VieNeu-TTS (Khuyên dùng - Cổng 8000)**: Mô hình đọc tiếng Việt tự nhiên chất lượng cao (48kHz), có sẵn 9 giọng đọc:
  ```bash
  git clone https://github.com/pnnbao97/VieNeu-TTS.git
  cd VieNeu-TTS
  uv sync
  uv run python -m apps.openai_speech
  ```
  *Mẹo trên Windows*: Khi đặt thư mục như sơ đồ trên, bạn chỉ cần bấm đúp file `tools/start_tts.bat` trong thư mục extension để khởi động nhanh.

- **VietTTS (Lựa chọn thêm - Cổng 8298)**:
  ```bash
  git clone https://github.com/dangvansam/viet-tts.git
  cd viet-tts
  pip install -e .
  viettts server --port 8298
  ```

- **Tùy biến máy chủ khác**: Extension tương thích với mọi máy chủ nói giao thức OpenAI speech (`POST /v1/audio/speech` và `GET /v1/voices`).

### 2. Cài đặt tiện ích vào Chrome

Chưa lên Chrome Web Store, nạp thủ công:

```bash
git clone https://github.com/luukhanhvinh1214/kiwi-text2speech.git
```

1. Mở `chrome://extensions`
2. Bật **Chế độ dành cho nhà phát triển** (góc trên bên phải)
3. Bấm **Tải tiện ích đã giải nén** và chọn thư mục `kiwi-text2speech`
4. Tải lại các tab đang mở

### 3. Bản ổn định

Nếu bạn không dùng git, hãy tải phiên bản nén ở đây:

[Google Drive](https://drive.google.com/drive/folders/1MsxgSmInAK9RLiVXIwOVCnTptzJl7tki?usp=sharing)

Tải về, giải nén, rồi làm bốn bước ở trên với thư mục vừa giải nén.

## Sử dụng

Bấm vào icon trên thanh công cụ hoặc thao tác trực tiếp trên trang:

- **Bong bóng đọc nhanh**: Bôi đen đoạn chữ trên bất kỳ trang web nào, một biểu tượng loa nhỏ sẽ hiện lên để bạn bấm đọc ngay mà không cần mở popup. Không muốn biểu tượng này hiện thì tắt công tắc ở góc phải phía trên popup.
- **Thẻ dịch trên trang**: Bấm vào nút dịch ở bong bóng để xem bản dịch và nghe phát âm bản dịch trực tiếp.
- **Menu chuột phải**: Chuột phải vào đoạn chữ đã bôi đen, chọn **Đọc đoạn đã chọn**.
- **Phóng to khung soạn thảo**: Bấm biểu tượng phóng to ở góc trên ô nhập văn bản trong popup để mở giao diện toàn màn hình, tiện xem và sửa các bài viết dài.
- **Tab Dịch trong popup**: Nhập văn bản nguồn, bấm dịch và chọn giọng đọc riêng cho bản dịch. Có nút sao chép và liên kết mở nhanh Google Dịch.

## Phím tắt

- `Alt+S`: Đọc đoạn văn bản đang chọn trên trang.
- `Alt+X`: Dừng đọc ngay lập tức.

## Giọng đọc

- **Giọng có sẵn trên máy (System)**: Dùng được ngay, không cần cài đặt (Microsoft An, David, Mark, Zira, Google US/UK...). Tự động ưu tiên giọng tiếng Việt nếu máy có.
- **Giọng AI tự nhiên qua máy chủ cục bộ (Local Server)**: Hỗ trợ các máy chủ giọng AI tiếng Việt chất lượng cao chạy trên máy (chuẩn OpenAI speech):
  - **VieNeu-TTS** (cổng 8000): `uv run python -m apps.openai_speech`
  - **VietTTS** (cổng 8298): `viettts server --port 8298`

Khi chọn giọng AI mà máy chủ chưa bật, popup sẽ hiện sẵn câu lệnh để bạn sao chép và khởi động. Xem chi tiết kỹ thuật tại [docs/engines.md](docs/engines.md).

---

## Tác giả

Dự án được xây dựng và phát triển bởi **Lưu Khánh Vinh** (**Vinhdeptrai**).

- GitHub: [@luukhanhvinh1214](https://github.com/luukhanhvinh1214)
- Email: asmodeus.kissa@gmail.com
