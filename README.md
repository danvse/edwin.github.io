# Edwin Lin portfolio

A static site (HTML, CSS, JS). No build step, so it works on GitHub Pages as is.

## Before you publish

1. **Add your resume.** Put a PDF at `assets/Edwin_Lin_Resume.pdf`. The site is public, so consider a version without your phone number or home address.
2. **Add your GitHub links.** In `index.html`, search for `YOUR-USERNAME`. Uncomment the two links (one in the Projects section for each project, one in Contact) and fill in your username and repo names.
3. **Check the details marked below.** These were inferred from your resume:
   - The Delta pin is placed near the airport in Atlanta.
   - Enterprise Hall is placed in downtown Atlanta.
   - The Contact section says you're open to software developer opportunities.
   - The boarding pass "To" field says "Software engineering roles".

## Add your photos (optional, but recommended)

The site shows photos automatically once these files exist. Nothing breaks if they're missing.

| File | Where it appears |
| --- | --- |
| `assets/headshot.jpg` | The photo slot on the boarding pass (portrait, roughly 4:5) |
| `assets/hero.jpg` | A faint background behind the top of the page (wide landscape, at least 1600 px across) |
| `assets/projects/accident-model.png` | Under the Car Accident Prediction diagram |
| `assets/projects/classroom-dashboard.png` | Under the Classroom Project Dashboard diagram |

Use photos you took or have the right to use. Delta's own photos and logos are copyrighted, so don't copy them from delta.com. Free-license sites like Unsplash, Pexels, and Wikimedia Commons work for a hero photo (check whether attribution is required).

## Deploy on GitHub Pages

1. Create a new repository on GitHub (for a root URL, name it `YOUR-USERNAME.github.io`).
2. Upload everything in this folder to the repository's main branch.
3. Go to **Settings, then Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute or two the site is live at `https://YOUR-USERNAME.github.io/` (or `/REPO-NAME/` for other repo names).

## The dashboard tab

Click **Dashboard demo** in the top menu (or visit `index.html#dashboard`). It's an interactive ticket-operations dashboard:

- Click a bar in **By category** or a circle in **By station** to filter every chart, number, and table.
- Use the **Priority** buttons and the **4 / 8 / 12 weeks** switch to narrow things further.
- Click any number at the top for a breakdown popup (a donut chart, histogram, confusion matrix, or line chart).
- Click a point on the **Tickets per week** line to open a scatter plot for that week.

All data is generated in `dashboard.js` with a fixed random seed, so it looks the same on every visit. It is sample data, not from Delta or ServiceNow, and the page says so. To change the data, edit the `CATS`, `STATIONS`, and `generate` sections near the top of that file.

## Files

- `index.html`: all the content
- `styles.css`: colors, type, and layout (design tokens are at the top)
- `script.js`: boarding pass animation, gauge ticks, the map that follows the experience cards, and the tab switching
- `dashboard.css` and `dashboard.js`: the dashboard tab
- `favicon.svg`: the site icon

## Notes

- The airline theme uses navy and red with original artwork. It does not use Delta's logo or other trademarks, and the footer says the site isn't affiliated with Delta.
- Fonts (Barlow Condensed and Public Sans) are self-hosted in `assets/fonts/` under the SIL Open Font License, so the site makes no requests to third-party servers.
