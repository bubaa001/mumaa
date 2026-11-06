# For Mumaa — Anna Joseph

A mobile-first graduation surprise for Anna, with a scroll-following plane, an embedded 3D flight game, a personal letter, and a camera-based keepsake card.

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
4. Leave the build command blank and set the output directory to `.`.
5. Deploy. Vercel will provide a shareable HTTPS URL.

### Save the graduation portrait privately
1. In the Vercel project, create and connect a **private** Blob store.
2. Deploy or redeploy the project so Vercel makes the Blob store available to the API.

After she takes or chooses a photo, the site automatically uploads it to the private store under `graduation-photos/anna-joseph/`; a new portrait replaces the previous one. The site has no keepsake login, so anyone who can reach its photo API can download or replace that saved portrait. To test locally, use `vercel dev` with the Blob store connected.

You can also deploy the folder using the Vercel CLI:

```bash
npm i -g vercel
vercel
```

## Personalise before sharing
- Edit the graduation-story and letter copy in `index.html`.
- The keepsake section asks for camera permission, or lets Anna choose a saved photo. The photo and card are prepared in her browser. The portrait is automatically saved to the connected private Vercel Blob store.
- The keepsake uses the supplied navy-and-gold graduation poster in `assets/graduation-poster-template.png`, placing Anna's photo inside its portrait frame.
- The exported PNG matches the poster's 768 × 960 artwork. On supported phones, the native share sheet can save or share it.
- The aircraft artwork is the supplied Lottie animation in `assets/plane-ticket.json`. Its scroll path is calculated in `script.js`, and its position changes with the visitor's scroll progress.
- The Google Fonts import is optional; the page falls back to system serif and sans-serif fonts if offline.

## Notes
- No database, account sign-in, or tracking is required.
- The letter opens only when the visitor taps the button.
- Camera permission is optional; choosing a saved photo is an alternative.
- The aircraft animation respects the device's reduced-motion accessibility setting.
- Lovewing opens from the flight invitation after the pilot-dream section. Its 3D game bundle loads only when opened and closes back to the story; swipe controls work inside the game on touch screens.
