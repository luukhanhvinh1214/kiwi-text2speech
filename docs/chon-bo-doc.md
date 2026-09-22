# Chọn bộ đọc cho extension

Ghi lại vì sao Kiwi Text to Speech có đúng hai bộ đọc, và một bộ mới muốn ghép
vào thì phải thoả những gì.

## Ràng buộc từ chỗ extension chạy

Extension chạy trong Chrome theo Manifest V3. Ba điều sau quyết định gần hết
thiết kế:

- Service worker không có `Audio`, không có `AudioContext`, và không có
  `speechSynthesis`. Muốn phát một file âm thanh thì phải mượn một trang khác,
  ở đây là offscreen document.
- Mọi thứ tải về đều nằm trong hạn ngạch của trình duyệt người dùng. Một mô
  hình vài trăm MB là không nhúng được, kể cả khi nó chạy được bằng WebAssembly.
- Người dùng mở extension ra là muốn nghe ngay. Bộ đọc nào cần cài đặt thêm thì
  không thể là lựa chọn mặc định.

## Các nguồn đã xem

### chrome.tts và Web Speech API

Có sẵn trong trình duyệt, không tải gì, không cấu hình gì, gọi được thẳng từ
service worker. Đây là lý do nó làm bộ đọc mặc định.

Đổi lại, chất lượng giọng phụ thuộc vào máy người dùng. Trên Windows thường chỉ
có giọng của hệ điều hành cộng với vài giọng Google chạy qua mạng; giọng tiếng
Việt có thể không có. Khi không có giọng nào khớp `vi-VN`, Chrome chọn giọng
khác và đọc tiếng Việt bằng ngữ âm sai.

### ZeroTTS

<https://github.com/zeroweight-ai/ZeroTTS> — mô hình tiếng Việt zero-shot chạy
trên ONNX Runtime, nhân bản giọng từ 3 giây mẫu. Theo README của dự án: nhanh
hơn thời gian thực khoảng hai lần trên CPU, đoạn âm đầu tiên sau chừng 70 ms.

Dự án có sẵn một bản chạy hoàn toàn trong trình duyệt (`js/`, WebAssembly), và
đó là thứ đáng xem nhất với chúng ta. Nhưng `docs/BROWSER.md` nói rõ bản đó phải
tải khoảng 820 MB trọng số rồi lưu lại bằng Cache API. Với một extension thì
không dùng được: người dùng bấm cài xong phải chờ tải gần 1 GB trước khi nghe
được câu đầu tiên.

Hai điều học được từ bản trình duyệt của họ, đã áp vào extension này:

- Tổng hợp phải nằm ngoài luồng giao diện. Họ đẩy vào Web Worker; ta đẩy việc
  phát và tải về offscreen document.
- Ghép các đoạn âm liền nhau phải liên tục, nếu không nghe rõ tiếng cắt giữa hai
  đoạn. Họ dùng vòng đệm trong AudioWorklet; ta tải trước đoạn kế tiếp trong lúc
  đoạn hiện tại đang phát.

ZeroTTS không có máy chủ HTTP nào sẵn, chỉ có SDK Python và một giao diện
Gradio. Vì vậy có thêm `tools/zerotts_server.py`, dựng đúng ba đường mà extension
cần. File đó là công cụ chạy trên máy, không nằm trong repo và không thuộc phần
đóng gói extension.

### VieNeu-TTS

<https://github.com/pnnbao97/VieNeu-TTS> — mô hình tiếng Việt, bản mã nguồn mở
mới nhất là v3 Turbo. Theo README của dự án: 48 kHz, 25 giọng dựng sẵn, nhân
bản giọng từ 3 đến 8 giây mẫu, đoạn âm đầu tiên sau chừng 115 ms.

Điểm khiến nó thành lựa chọn số hai của extension: `apps/openai_speech.py` đã
dựng sẵn `POST /v1/audio/speech` theo đúng hình dạng API của OpenAI, kèm
`GET /v1/voices` và `GET /v1/models`, chạy mặc định ở `127.0.0.1:8000`. Extension
gọi thẳng vào, không cần viết thêm gì.

Vài chỗ cần biết khi đọc mã của họ:

- Chỉ nhận `response_format` là `pcm` hoặc `wav`. Gửi `mp3` thì trả về 400.
- Trường `speed` được nhận nhưng bị bỏ qua, và máy chủ báo lại bằng header
  `X-VieNeu-Ignored`. Vì thế tốc độ đọc ở bộ đọc máy chủ được chỉnh bằng
  `playbackRate` của thẻ audio, không phải bằng tham số gửi đi.
- Có `VIENEU_API_KEY` để bật xác thực Bearer. Extension hỗ trợ khoá này.
- Bản v4 không mở mã nguồn, chỉ dùng được qua dịch vụ của họ.

### Những nguồn phổ biến khác

Đã cân nhắc và không chọn, ghi lại để khỏi xét lại từ đầu:

- **Dịch vụ đám mây** (Google Cloud TTS, Azure Speech, Amazon Polly, OpenAI
  TTS, ElevenLabs): giọng tốt, nhưng mỗi lần đọc là một lần gửi nội dung người
  dùng đang xem lên máy chủ của bên thứ ba, và cần khoá trả phí. Không hợp làm
  mặc định. Ai cần thì vẫn dùng được: chúng đều nói giao thức OpenAI speech hoặc
  gần như thế, chỉ cần đổi địa chỉ trong phần cài đặt.
- **Piper**: nhẹ, chạy tốt trên máy yếu, có giọng tiếng Việt. Đáng thêm sau,
  nhưng phải viết cầu nối HTTP riêng vì nó là công cụ dòng lệnh.
- **Coqui XTTS**: nhân bản giọng đa ngữ, nặng hơn hai lựa chọn trên và dự án gốc
  đã ngừng phát triển.
- **edge-tts**: chất lượng tốt và không mất tiền, nhưng nó gọi vào một đầu cuối
  nội bộ của Microsoft, không phải API công khai. Không dựa vào được.

## Giao kèo chung

Bộ đọc máy chủ trong extension chỉ cần đối phương thoả:

```
POST {baseUrl}/v1/audio/speech
     { "model": ..., "input": ..., "voice": ..., "response_format": "wav", "sample_rate": ... }
     -> thân trả về là audio/wav

GET  {baseUrl}/v1/voices   -> { "data": [ { "name": ..., "lang": ... } ] }
GET  {baseUrl}/v1/models   -> { "data": [ { "id": ... } ] }
```

Khoá truy cập, nếu có, đi bằng header `Authorization: Bearer ...`.

Thêm một bộ đọc mới nghĩa là dựng một máy chủ nói đúng ba đường trên, rồi đổi
địa chỉ trong phần cài đặt. Không phải sửa mã extension.

## Chạy từng bộ đọc

VieNeu-TTS:

```
git clone https://github.com/pnnbao97/VieNeu-TTS
cd VieNeu-TTS
uv sync
uv run python -m apps.openai_speech
```

ZeroTTS, qua cầu nối trong repo này:

```
pip install zerotts fastapi uvicorn
python tools/zerotts_server.py
```

Lần chạy đầu của cả hai đều tải trọng số về máy, cỡ vài trăm MB tới ngót một GB.

Kiểm tra máy chủ đã lên chưa, không cần mở trình duyệt:

```
node -e "require('http').get('http://127.0.0.1:8000/v1/models', r => r.pipe(process.stdout))"
```

Trong phần cài đặt của extension, chọn **Máy chủ trên máy**, điền địa chỉ rồi
bấm **Thử kết nối**.
