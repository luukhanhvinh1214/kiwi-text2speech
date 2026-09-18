# Chọn bộ đọc cho extension

Ghi lại vì sao Kiwi Text to Speech có đúng hai bộ đọc, những máy chủ tiếng Việt
nào được khai sẵn, và một bộ mới muốn ghép vào thì phải thoả những gì.

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

Extension không bày hết những gì `chrome.tts.getVoices` trả về. Danh sách cho
phép nằm trong `src/kt_voices.js`, hiện có Microsoft An, David, Mark, Zira và các
giọng Google UK English, Google US English. Windows liệt kê cùng một giọng dưới
hai bộ máy, ví dụ "Microsoft David Desktop" và "Microsoft David", nên phần lọc
cắt đuôi rồi mới so để trong danh sách chỉ còn một dòng.

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
- Có `VIENEU_API_KEY` để bật xác thực Bearer. Extension gửi được khoá này nhưng
  không có ô nhập; khoá đặt thẳng vào `chrome.storage` theo id của máy chủ.
- Bản v4 không mở mã nguồn, chỉ dùng được qua dịch vụ của họ.

### VietTTS

<https://github.com/dangvansam/viet-tts> — mô hình tiếng Việt có sẵn 24 giọng
dựng trước và nhân bản giọng từ một đoạn mẫu. Chạy ở `127.0.0.1:8298`, cũng nói
giao thức OpenAI speech nên ghép vào không tốn dòng mã nào ngoài phần khai sẵn.

Khác VieNeu ở ba chỗ đã phải xử lý:

- Không có `GET /v1/models`, chỉ có `GET /v1/voices`. Vì thế phần dò máy chủ của
  extension hỏi `/v1/voices` chứ không hỏi `/v1/models`.
- Không nhận `sample_rate`. Máy chủ nào khai `sampleRate: null` thì lời gọi bỏ
  hẳn trường đó thay vì gửi giá trị mặc định.
- Mã nguồn theo Apache 2.0 nhưng trọng số theo CC BY-NC, tức là không dùng cho
  việc thương mại được.

Trong số 24 giọng, extension chỉ khai sẵn những giọng chung như `nu-nhe-nhang`,
`quynh`, `diep-chi`, `cdteam`, `atuan` và vài giọng `speechify`. Các giọng nhân
bản theo người thật có tên trong danh sách của dự án thì không khai; ai chạy máy
chủ vẫn thấy chúng, vì extension gộp thêm danh sách giọng mà máy chủ trả về.

### Những nguồn phổ biến khác

Đã cân nhắc và không chọn, ghi lại để khỏi xét lại từ đầu:

- **Dịch vụ đám mây** (Google Cloud TTS, Azure Speech, Amazon Polly, OpenAI
  TTS, ElevenLabs): giọng tốt, nhưng mỗi lần đọc là một lần gửi nội dung người
  dùng đang xem lên máy chủ của bên thứ ba, và cần khoá trả phí. Không hợp làm
  mặc định. Ai cần thì vẫn dùng được: chúng đều nói giao thức OpenAI speech hoặc
  gần như thế, chỉ cần khai thêm một mục trong `SERVER_PRESETS`.
- **Piper**: nhẹ, chạy tốt trên máy yếu, có giọng tiếng Việt, nhưng là công cụ
  dòng lệnh nên phải mượn cầu nối. Speaches (<https://speaches.ai>) dựng sẵn
  `/v1/audio/speech` cho cả Piper lẫn Kokoro, đó là đường ngắn nhất nếu cần một
  bộ đọc chạy được trên máy yếu. Chưa khai sẵn vì tên mô hình bên đó chưa kiểm
  trên máy thật.
- **F5-TTS tiếng Việt của EraX**: tinh chỉnh từ F5-TTS trên hơn hai triệu mẫu
  tiếng Việt, chất lượng tốt. Giấy phép CC BY-NC và chưa có máy chủ HTTP sẵn.
- **Chatterbox Multilingual v3** (Resemble AI): giấy phép MIT, có tiếng Việt,
  nhân bản giọng zero-shot. Điểm vướng là mọi bản âm thanh sinh ra đều bị đóng
  dấu chìm, và mô hình chạy nặng hơn hẳn hai lựa chọn trên.
- **Coqui XTTS**: nhân bản giọng đa ngữ, nặng hơn và dự án gốc đã ngừng phát
  triển.
- **edge-tts**: chất lượng tốt và không mất tiền, nhưng nó gọi vào một đầu cuối
  nội bộ của Microsoft, không phải API công khai. Không dựa vào được.

## Giao kèo chung

Bộ đọc máy chủ trong extension chỉ cần đối phương thoả:

```
POST {baseUrl}/v1/audio/speech
     { "model": ..., "input": ..., "voice": ..., "response_format": "wav", "sample_rate": ... }
     -> thân trả về là audio/wav

GET  {baseUrl}/v1/voices   -> { "data": [ { "name": ..., "lang": ... } ] }
```

`sample_rate` chỉ được gửi khi mục khai sẵn có đặt `sampleRate`. Danh sách giọng
nhận cả ba dạng hay gặp: mảng chuỗi, `{ "data": [...] }`, hoặc một đối tượng lấy
tên giọng làm khoá. Khoá truy cập, nếu có, đi bằng header
`Authorization: Bearer ...`, và chỉ đọc từ `chrome.storage`.

Thêm một bộ đọc mới gồm hai việc: dựng một máy chủ nói đúng hai đường trên, rồi
thêm một mục vào `SERVER_PRESETS` trong `src/kt_voices.js` với địa chỉ, tên mô
hình, vài giọng tiêu biểu và lệnh chạy. Lệnh chạy đó chính là câu mà popup hiện
lên khi máy chủ chưa bật.

## Danh sách giọng hiện ra thế nào

Mỗi lần mở popup, extension hỏi cả ba máy chủ đã khai một lượt, hạn chờ hai giây
cho mỗi máy. Máy nào trả lời thì nhóm giọng của nó hiện đủ cả giọng khai sẵn lẫn
giọng máy chủ báo về, kể cả giọng người dùng vừa nhân bản thêm. Máy nào im thì
nhóm đó vẫn hiện nhưng kèm chữ "chưa chạy", và chọn vào đó rồi bấm đọc sẽ nhận
đúng câu nhắc kèm lệnh chạy thay vì một lỗi mạng.

Giọng mặc định không bao giờ được ghi vào cài đặt. Ngay sau khi Chrome khởi
động, `chrome.tts.getVoices` có thể còn thiếu giọng của hệ điều hành; ghi lúc đó
là chốt nhầm một giọng tiếng Anh rồi giữ mãi. Cài đặt chỉ lưu giọng do người
dùng tự chọn.

## Chạy từng bộ đọc

VieNeu-TTS, cổng 8000:

```
git clone https://github.com/pnnbao97/VieNeu-TTS
cd VieNeu-TTS
uv sync
uv run python -m apps.openai_speech
```

VietTTS, cổng 8298:

```
git clone https://github.com/dangvansam/viet-tts
cd viet-tts
pip install -e .
viettts server --port 8298
```

ZeroTTS, qua cầu nối trong repo này, cổng 8001 để không đụng VieNeu:

```
pip install zerotts fastapi uvicorn
python tools/zerotts_server.py
```

Lần chạy đầu của cả ba đều tải trọng số về máy, cỡ vài trăm MB tới ngót một GB.

Kiểm tra máy chủ đã lên chưa, không cần mở trình duyệt:

```
node -e "require('http').get('http://127.0.0.1:8000/v1/voices', r => r.pipe(process.stdout))"
```

Trong popup, chọn giọng thuộc nhóm của máy chủ đó rồi bấm nút đọc.
