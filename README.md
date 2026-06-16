# ⚡ BigQuery Release Pulse

BigQuery Release Pulse is a sleek, modern web application built with **Python Flask**, **Vanilla JavaScript**, and **Custom CSS** that fetches, categorizes, and filters Google Cloud BigQuery release notes. It features a custom X (Twitter) integration, allowing users to draft and share updates directly to their social accounts.

---

## ✨ Features

- **Automatic Live Aggregation**: Fetches the official Google Cloud BigQuery Atom feed and parses it dynamically using `BeautifulSoup`.
- **Intelligent Release Categorization**: Releases are parsed into discrete updates (Features, Issues, Deprecations, General updates) and color-coded with specific badges.
- **Instant Search & Filters**: Clean client-side search indexing and category filters let you narrow down updates in real-time.
- **Smart Caching**: In-memory caching for 15 minutes prevents rate limits and ensures rapid page loads, with a manual **Refresh** button (and spinner) to query the latest feed.
- **Individual Tweet Composer**: Opens a custom composer modal that pre-formats the update description, truncates it to fit Twitter's character limit, and appends hashtags and direct anchor links.
- **Multi-Select Thread/Summary Tweeting**: Select multiple updates to compile a bulleted summary tweet dynamically.
- **Premium Glassmorphic Design**: Dark-theme aesthetics with floating background gradients, backdrop-filters, interactive hovers, and a character count progress ring modeled after Twitter/X.

---

## 📂 Project Directory Structure

```text
├── app.py                  # Main Flask application & RSS Parser
├── templates/
│   └── index.html          # Main HTML5 layout & Modal components
├── static/
│   ├── css/
│   │   └── style.css       # Premium CSS stylesheet
│   └── js/
│       └── main.js         # State, search filters, and Tweet composer scripts
├── .gitignore              # Python, OS, and Virtual Env excludes
└── README.md               # Project documentation
```

---

## 🚀 Getting Started

### 📋 Prerequisites

Make sure you have Python 3.8+ installed on your system.

### 🔧 Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/aristea-k-wijaya/antigravity-event-talks-app.git
   cd antigravity-event-talks-app
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install the dependencies**:
   ```bash
   pip install flask requests beautifulsoup4 lxml
   ```

### 💻 Running the Application

1. **Start the Flask development server**:
   ```bash
   python app.py
   ```

2. **Access the portal**:
   Open your browser and navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

---

## 🐦 Tweet Composer Mechanics

The tweet composer calculates character counts dynamically:
- Classic links are automatically counted as **23 characters** by Twitter's `t.co` link shortener.
- The composer uses an SVG progress ring that changes color based on length:
  - 🟢 **Cyan**: Normal length
  - 🟡 **Amber**: Less than 20 characters remaining
  - 🔴 **Rose**: Exceeded the 280-character limit (the *Post on X* button is disabled automatically)
- Includes a **Copy** button to copy the drafted text to your clipboard or **Post on X** to open a new tab containing Twitter's Web Intent composer pre-populated.
