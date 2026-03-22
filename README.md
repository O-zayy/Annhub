# Annhub // Anime & Play

## 📌 Project Overview
Annhub is a premium, highly interactive web application designed for anime discovery and entertainment. Built with a sleek, dark-themed "Cred-inspired" aesthetic, the platform allows users to explore top-rated anime, read iconic character quotes, and browse visual galleries. 

Beyond standard data fetching, Annhub is engineered for high resilience. It features a custom-built, multi-tiered API fallback system to ensure the application remains functional even if the primary data sources experience downtime or rate-limiting. The UI is further enhanced with custom WebGL background effects (LightRays), canvas-based interaction sparks, and an integrated mini-arcade game.

## ⚙️ APIs Utilized
This project aggregates content using a robust combination of public APIs:
* **Jikan API / AniList GraphQL (Primary):** Used for fetching comprehensive anime data, including top-rated series, synopses, scores, and trailer embeds.
* **Fallback Cascade:** If the primary fetch fails, the system automatically cascades through **Kitsu API** and **Shikimori API**, finally defaulting to a curated **Hardcoded Dataset** to guarantee zero downtime.
* **Animechan API:** Powers the "Daily Wisdom" section, serving random, database-driven anime quotes.
* **Nekos.best API:** Populates the interactive character image gallery.

## 🚀 Planned Features (Upcoming Milestones)
While the core fetching, fallback architecture, and UI foundation are implemented, upcoming milestones will introduce advanced data manipulation:

* **Dynamic Search:** A real-time search bar allowing users to query specific anime titles across the integrated APIs.
* **Advanced Filtering:** Users will be able to filter the main discovery grid by parameters such as Genre (Action, Romance, Sci-Fi) and Status (Releasing, Finished).
* **Sorting Mechanisms:** Capability to sort the anime grid dynamically by Highest Rated, Most Popular, and Newest Releases.
* **Interactive Media Player:** A custom-built, immersive modal overlay for viewing anime trailers with custom volume sliders and progress controls.
* **Expanded Arcade Module:** Enhancements to "Neon Strike", the built-in canvas reflex training game tied to the platform's neon aesthetic.

## 💻 Technologies Involved
* **Frontend:** HTML5, modern CSS3
* **Styling:** Tailwind CSS (via CDN for rapid styling), Custom CSS for targeted animations and custom target-cursors.
* **Logic & State:** Vanilla JavaScript (ES6+), utilizing the Fetch API, Promises, and `async/await` for asynchronous data handling.
* **Animations & Effects:** * GSAP (GreenSock) for smooth scroll triggers and element reveals.
  * HTML `<canvas>` API for interactive click sparks.
  * OGL (Minimal WebGL) for the dynamic, mouse-tracking light rays hero background.

## 🛠️ Setup and Installation
This project is built with static web technologies and requires no heavy build steps or package managers.

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/yourusername/annhub.git](https://github.com/yourusername/annhub.git)
   
