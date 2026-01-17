# Highlight Fact Checker (Chrome Extension + Backend)

This project includes:
- **Chrome extension (Manifest V3)** that adds a right-click **Fact-check** menu for highlighted text and displays results in a **side panel**.
- **Backend server** (Node/Express) that calls the **OpenAI Responses API** with the **web search tool** to return a verdict *with sources*.

> Why a backend? Never put your OpenAI API key inside an extension — it can be extracted.

---

## Folder structure

```
factcheck-extension/
  extension/   # load this folder in Chrome
  server/      # run this locally (or deploy it)
```

---

## 1) Run the backend locally

1. Open a terminal in `server/`
2. Install dependencies:

```bash
npm install
```

3. Create an `.env` file:

```bash
cp .env.example .env
```

4. Edit `.env` and set `OPENAI_API_KEY=...`

5. Start the server:

```bash
npm start
```

It will run at `http://localhost:8787`.

---

## 2) Load the extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder

---

## 3) Use it

1. Open any webpage (e.g., a Facebook post)
2. Highlight a claim
3. Right-click → **Fact-check**
4. The side panel will open and show:
   - Verdict (True/False/Misleading/Unclear)
   - Confidence
   - Explanation
   - Sources

---

## Configure backend URL

If your backend isn’t on `http://localhost:8787`, edit:

- `extension/config.js`

and change `BACKEND_URL`.

---

## Notes

- The backend uses OpenAI **web search** tool, so the model can retrieve current sources.
- The backend returns structured JSON (verdict, confidence, sources), which the side panel renders.
- For production, deploy the backend and restrict CORS + add rate limiting.
