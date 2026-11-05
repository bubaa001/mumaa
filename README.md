# For Mumaa — Anna Joseph

A mobile-first graduation surprise for Anna, with a scroll-following plane, personal letter, camera-based keepsake card, and animated gift-box reveal.

## Run locally
Install the dependencies and start Vite:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Camera access works on `localhost` and on secure HTTPS deployments.

## Deploy to Vercel
1. Create a GitHub repository and upload the contents of this folder.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Keep the framework preset as **Other**.
4. Leave the build command and output directory blank (or use `.` as the output directory).
5. Deploy. Vercel will provide a shareable HTTPS URL.

You can also deploy the folder using the Vercel CLI:

```bash
npm i -g vercel
vercel
```

## Personalise before sharing
- Edit the graduation-story and letter copy in `index.html`.
- The keepsake section asks for camera permission, or lets Anna choose a saved photo. The photo and card are processed in her browser; the site does not upload them.
- The keepsake uses the supplied navy-and-gold graduation poster in `assets/graduation-poster-template.png`, placing Anna's photo inside its portrait frame.
- The exported PNG matches the poster's 768 × 960 artwork. On supported phones, the native share sheet can save or share it.
- The aircraft artwork is the supplied Lottie animation in `assets/plane-ticket.json`. Its scroll path is calculated in `script.js`, and its position changes with the visitor's scroll progress.
- The Google Fonts import is optional; the page falls back to system serif and sans-serif fonts if offline.

## Notes
- No database, sign-in, tracking, or paid service is required.
- The letter opens only when the visitor taps the button.
- Camera permission is optional; choosing a saved photo is an alternative.
- The aircraft animation respects the device's reduced-motion accessibility setting.
