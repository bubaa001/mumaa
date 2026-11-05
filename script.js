import lottie from 'lottie-web/build/player/lottie_light';
import planeData from './assets/plane-ticket.json';
import posterTemplateUrl from './assets/graduation-poster-template.png';
import posterFrameMaskUrl from './assets/graduation-poster-frame-mask.png';

(() => {
  const flightDialog = document.getElementById('lovewingDialog');
  const launchLovewing = document.getElementById('launchLovewing');
  const closeLovewing = document.getElementById('closeLovewing');
  const lovewingFrame = document.getElementById('lovewingFrame');
  const lovewingLoading = document.getElementById('lovewingLoading');
  let gameLoadTimer = 0;

  lovewingFrame.addEventListener('load', () => {
    window.clearTimeout(gameLoadTimer);
    if (flightDialog.open) lovewingLoading.hidden = true;
  });

  launchLovewing.addEventListener('click', () => {
    if (!flightDialog.open) flightDialog.showModal();
    lovewingLoading.textContent = 'Getting your flight ready.';
    lovewingLoading.hidden = false;
    lovewingFrame.hidden = false;
    lovewingFrame.src = '/lovewing/';
    window.clearTimeout(gameLoadTimer);
    gameLoadTimer = window.setTimeout(() => {
      if (flightDialog.open && !lovewingLoading.hidden) {
        lovewingLoading.textContent = 'The flight is taking a while. Close this screen and try again.';
      }
    }, 15000);
  });

  function closeFlight() {
    if (flightDialog.open) flightDialog.close();
    window.clearTimeout(gameLoadTimer);
    lovewingLoading.hidden = true;
    lovewingFrame.hidden = true;
    lovewingFrame.removeAttribute('src');
    launchLovewing.focus({ preventScroll: true });
  }

  closeLovewing.addEventListener('click', closeFlight);
  flightDialog.addEventListener('cancel', () => lovewingFrame.removeAttribute('src'));
  flightDialog.addEventListener('close', closeFlight);

  const plane = document.getElementById('plane');
  lottie.loadAnimation({
    container: plane,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    animationData: planeData,
    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
  });

  const glow = document.querySelector('.plane-glow');
  const trail = document.querySelector('.plane-trail');
  const progressBar = document.getElementById('progressBar');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const climbEndsAt = .42;
  const springStrength = 95;
  const damping = 18;
  let targetProgress = 0;
  let flightProgress = 0;
  let flightVelocity = 0;
  let previousFrameTime = 0;
  let frameRequest = 0;

  function cubicPoint(start, control1, control2, end, t) {
    const inverse = 1 - t;
    return {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x +
        3 * inverse * t ** 2 * control2.x + t ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y +
        3 * inverse * t ** 2 * control2.y + t ** 3 * end.y
    };
  }

  function cubicTangent(start, control1, control2, end, t) {
    const inverse = 1 - t;
    return {
      x: 3 * inverse ** 2 * (control1.x - start.x) +
        6 * inverse * t * (control2.x - control1.x) +
        3 * t ** 2 * (end.x - control2.x),
      y: 3 * inverse ** 2 * (control1.y - start.y) +
        6 * inverse * t * (control2.y - control1.y) +
        3 * t ** 2 * (end.y - control2.y)
    };
  }

  function pointOnFlight(progress) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const join = { x: width * .32, y: height * .19 };
    const first = {
      start: { x: width * .2, y: height * .72 },
      control1: { x: width * .2, y: height * .49 },
      control2: { x: width * .25, y: height * .19 },
      end: join
    };
    const second = {
      start: join,
      control1: { x: width * .53, y: height * .19 },
      control2: { x: width * .76, y: height * .19 },
      end: { x: width * .86, y: height * .19 }
    };
    const climbing = progress < climbEndsAt;
    const curve = climbing ? first : second;
    const curveProgress = climbing
      ? progress / climbEndsAt
      : (progress - climbEndsAt) / (1 - climbEndsAt);
    return {
      position: cubicPoint(curve.start, curve.control1, curve.control2, curve.end, curveProgress),
      tangent: cubicTangent(curve.start, curve.control1, curve.control2, curve.end, curveProgress)
    };
  }

  function renderFlight(progress) {
    const { position, tangent } = pointOnFlight(progress);
    const angle = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI;
    const width = plane.offsetWidth;
    const height = plane.offsetHeight;
    plane.style.transform =
      `translate3d(${position.x - width / 2}px, ${position.y - height / 2}px, 0) rotate(${angle}deg)`;

    if (glow) {
      glow.style.transform = `translate3d(${position.x - glow.offsetWidth / 2}px, ${position.y - glow.offsetHeight / 2}px, 0)`;
    }

    if (trail) {
      const trailLength = trail.offsetWidth;
      const tailOffset = width * .55;
      const radians = angle * Math.PI / 180;
      const trailX = position.x - Math.cos(radians) * tailOffset - trailLength / 2;
      const trailY = position.y - Math.sin(radians) * tailOffset - trail.offsetHeight / 2;
      trail.style.transform = `translate3d(${trailX}px, ${trailY}px, 0) rotate(${angle}deg)`;
    }
  }

  function updateFlight(time) {
    frameRequest = 0;
    const elapsed = previousFrameTime ? Math.min((time - previousFrameTime) / 1000, .032) : 1 / 60;
    previousFrameTime = time;

    const acceleration = springStrength * (targetProgress - flightProgress) - damping * flightVelocity;
    flightVelocity += acceleration * elapsed;
    flightProgress += flightVelocity * elapsed;

    if (Math.abs(targetProgress - flightProgress) < .0005 && Math.abs(flightVelocity) < .002) {
      flightProgress = targetProgress;
      flightVelocity = 0;
      previousFrameTime = 0;
    }

    renderFlight(flightProgress);
    if (flightVelocity !== 0 || flightProgress !== targetProgress) {
      frameRequest = window.requestAnimationFrame(updateFlight);
    }
  }

  function requestFlightUpdate() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    targetProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    progressBar.style.width = `${targetProgress * 100}%`;

    if (reducedMotion) {
      flightProgress = targetProgress;
      renderFlight(flightProgress);
      return;
    }
    if (!frameRequest) frameRequest = window.requestAnimationFrame(updateFlight);
  }

  if (!reducedMotion) {
    window.addEventListener('scroll', requestFlightUpdate, {passive:true});
    window.addEventListener('resize', requestFlightUpdate);
  }
  requestFlightUpdate();

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {threshold:0.14});
    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add('visible'));
  }

  const openLetter = document.getElementById('openLetter');
  const letterClosed = document.getElementById('letterClosed');
  const letterContent = document.getElementById('letterContent');
  const letterPs = document.getElementById('letterPs');
  openLetter.addEventListener('click', () => {
    letterClosed.hidden = true;
    letterContent.hidden = false;
    letterContent.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block:'nearest'});
    window.setTimeout(() => {
      letterPs.hidden = false;
    }, reducedMotion ? 0 : 800);
  });

  const cameraPreview = document.getElementById('cameraPreview');
  const photoPreview = document.getElementById('photoPreview');
  const cardPortrait = document.getElementById('cardPortrait');
  const cameraPlaceholder = document.getElementById('cameraPlaceholder');
  const cameraFrame = document.getElementById('cameraFrame');
  const cameraStatus = document.getElementById('cameraStatus');
  const cameraError = document.getElementById('cameraError');
  const startCamera = document.getElementById('startCamera');
  const capturePhoto = document.getElementById('capturePhoto');
  const retakePhoto = document.getElementById('retakePhoto');
  const photoUpload = document.getElementById('photoUpload');
  const giftReveal = document.getElementById('giftReveal');
  const giftLayout = document.getElementById('giftLayout');
  const openGift = document.getElementById('openGift');
  const graduationCard = document.getElementById('graduationCard');
  const saveCard = document.getElementById('saveCard');
  const cardSaveNote = document.getElementById('cardSaveNote');
  const cardLoveNote = document.getElementById('cardLoveNote');
  const openFinalSurprise = document.getElementById('openFinalSurprise');
  const finalSurpriseMessage = document.getElementById('finalSurpriseMessage');

  openFinalSurprise.addEventListener('click', () => {
    const expanded = openFinalSurprise.getAttribute('aria-expanded') === 'true';
    openFinalSurprise.setAttribute('aria-expanded', String(!expanded));
    finalSurpriseMessage.hidden = expanded;
  });

  let cameraStream = null;
  let photoUrl = null;
  let cardArtworkUrl = null;
  let cardImageBlob = null;

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    cameraPreview.srcObject = null;
    cameraPreview.hidden = true;
    capturePhoto.hidden = true;
    cameraFrame.classList.remove('is-live');
  }

  function showCameraError(message) {
    cameraError.textContent = message;
    cameraError.hidden = false;
  }

  function clearPhoto() {
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
      photoUrl = null;
    }
    if (cardArtworkUrl) {
      URL.revokeObjectURL(cardArtworkUrl);
      cardArtworkUrl = null;
    }
    cardImageBlob = null;
    photoPreview.removeAttribute('src');
    cardPortrait.removeAttribute('src');
    photoPreview.hidden = true;
    cameraPlaceholder.hidden = false;
    cameraFrame.classList.remove('has-photo');
    giftReveal.hidden = true;
    giftLayout.classList.remove('is-open');
    openGift.setAttribute('aria-expanded', 'false');
    graduationCard.setAttribute('aria-hidden', 'true');
    saveCard.hidden = true;
    cardSaveNote.textContent = '';
    cardLoveNote.hidden = true;
  }

  async function setPhoto(blob) {
    if (!blob || !blob.type.startsWith('image/')) {
      showCameraError('Please choose a valid image file.');
      return;
    }

    const nextUrl = URL.createObjectURL(blob);
    const decodedImage = new Image();
    decodedImage.src = nextUrl;

    try {
      await decodedImage.decode();
    } catch (error) {
      URL.revokeObjectURL(nextUrl);
      showCameraError('That photo could not be opened. Please choose another image.');
      return;
    }

    photoUrl = nextUrl;
    try {
      cardImageBlob = await createCardImage();
    } catch (error) {
      URL.revokeObjectURL(nextUrl);
      photoUrl = null;
      showCameraError('Your photo opened, but the graduation card could not be prepared. Please try another photo.');
      return;
    }

    if (cardArtworkUrl) URL.revokeObjectURL(cardArtworkUrl);
    cardArtworkUrl = URL.createObjectURL(cardImageBlob);
    photoPreview.src = photoUrl;
    cardPortrait.src = cardArtworkUrl;
    photoPreview.hidden = false;
    cameraPlaceholder.hidden = true;
    cameraFrame.classList.add('has-photo');
    cameraError.hidden = true;
    cameraStatus.textContent = 'Your photo stays on this device. Your little gift is ready.';
    giftReveal.hidden = false;
    giftReveal.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block:'center'});
  }

  startCamera.addEventListener('click', async () => {
    clearPhoto();
    stopCamera();
    retakePhoto.hidden = true;
    cameraError.hidden = true;
    cameraStatus.textContent = 'Opening your camera…';

    if (!navigator.mediaDevices?.getUserMedia) {
      cameraStatus.textContent = 'Camera access is not available here.';
      showCameraError('Open this page over HTTPS and try again, or choose a saved photo instead.');
      return;
    }

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'user' } }
      });
      cameraPreview.srcObject = cameraStream;
      cameraPreview.hidden = false;
      cameraFrame.classList.add('is-live');
      await cameraPreview.play();
      startCamera.hidden = true;
      capturePhoto.hidden = false;
      cameraStatus.textContent = 'When you are ready, take your picture.';
    } catch (error) {
      stopCamera();
      cameraStatus.textContent = 'Your camera could not be opened.';
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        showCameraError('Camera access was blocked. Allow camera access in your browser settings, or choose a saved photo instead.');
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        showCameraError('No usable camera was found. You can choose a saved photo instead.');
      } else if (error.name === 'NotReadableError') {
        showCameraError('Your camera is being used by another app. Close that app and try again, or choose a saved photo.');
      } else {
        showCameraError('The camera could not start. Check your browser permissions and secure connection, or choose a saved photo.');
      }
    }
  });

  capturePhoto.addEventListener('click', () => {
    if (!cameraPreview.videoWidth || !cameraPreview.videoHeight) {
      showCameraError('The camera is still getting ready. Please try again in a moment.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1250;
    const context = canvas.getContext('2d');
    const sourceRatio = cameraPreview.videoWidth / cameraPreview.videoHeight;
    const targetRatio = canvas.width / canvas.height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = cameraPreview.videoWidth;
    let sourceHeight = cameraPreview.videoHeight;

    if (sourceRatio > targetRatio) {
      sourceWidth = cameraPreview.videoHeight * targetRatio;
      sourceX = (cameraPreview.videoWidth - sourceWidth) / 2;
    } else {
      sourceHeight = cameraPreview.videoWidth / targetRatio;
      sourceY = (cameraPreview.videoHeight - sourceHeight) / 2;
    }

    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(
      cameraPreview,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, canvas.width, canvas.height
    );
    canvas.toBlob(blob => {
      if (!blob) {
        showCameraError('The picture could not be saved. Please try again.');
        return;
      }
      stopCamera();
      startCamera.hidden = true;
      retakePhoto.hidden = false;
      setPhoto(blob);
    }, 'image/jpeg', 0.94);
  });

  retakePhoto.addEventListener('click', () => {
    retakePhoto.hidden = true;
    startCamera.hidden = false;
    cameraStatus.textContent = 'Your previous picture has been cleared.';
    startCamera.click();
  });

  photoUpload.addEventListener('change', async () => {
    const [file] = photoUpload.files;
    if (!file) return;

    stopCamera();
    clearPhoto();
    startCamera.hidden = true;
    retakePhoto.hidden = false;
    cameraError.hidden = true;
    cameraStatus.textContent = 'Preparing your photo…';
    await setPhoto(file);
    photoUpload.value = '';
  });

  openGift.addEventListener('click', () => {
    const isOpen = giftLayout.classList.toggle('is-open');
    openGift.setAttribute('aria-expanded', String(isOpen));
    openGift.querySelector('.gift-box-label').textContent = isOpen
      ? 'Close your little gift'
      : 'Open your little gift';
    graduationCard.setAttribute('aria-hidden', String(!isOpen));
    saveCard.hidden = !isOpen;
    if (isOpen) {
      graduationCard.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block:'center'});
    }
  });

  function drawPhotoTriangle(context, image, sourcePoints, targetPoints) {
    const [sourceA, sourceB, sourceC] = sourcePoints;
    const [targetA, targetB, targetC] = targetPoints;
    const determinant = sourceA.x * (sourceB.y - sourceC.y) +
      sourceB.x * (sourceC.y - sourceA.y) +
      sourceC.x * (sourceA.y - sourceB.y);
    const a = (
      targetA.x * (sourceB.y - sourceC.y) +
      targetB.x * (sourceC.y - sourceA.y) +
      targetC.x * (sourceA.y - sourceB.y)
    ) / determinant;
    const c = (
      targetA.x * (sourceC.x - sourceB.x) +
      targetB.x * (sourceA.x - sourceC.x) +
      targetC.x * (sourceB.x - sourceA.x)
    ) / determinant;
    const e = (
      targetA.x * (sourceB.x * sourceC.y - sourceC.x * sourceB.y) +
      targetB.x * (sourceC.x * sourceA.y - sourceA.x * sourceC.y) +
      targetC.x * (sourceA.x * sourceB.y - sourceB.x * sourceA.y)
    ) / determinant;
    const b = (
      targetA.y * (sourceB.y - sourceC.y) +
      targetB.y * (sourceC.y - sourceA.y) +
      targetC.y * (sourceA.y - sourceB.y)
    ) / determinant;
    const d = (
      targetA.y * (sourceC.x - sourceB.x) +
      targetB.y * (sourceA.x - sourceC.x) +
      targetC.y * (sourceB.x - sourceA.x)
    ) / determinant;
    const f = (
      targetA.y * (sourceB.x * sourceC.y - sourceC.x * sourceB.y) +
      targetB.y * (sourceC.x * sourceA.y - sourceA.x * sourceC.y) +
      targetC.y * (sourceA.x * sourceB.y - sourceB.x * sourceA.y)
    ) / determinant;

    context.save();
    context.beginPath();
    context.moveTo(targetA.x, targetA.y);
    context.lineTo(targetB.x, targetB.y);
    context.lineTo(targetC.x, targetC.y);
    context.closePath();
    context.clip();
    context.transform(a, b, c, d, e, f);
    context.drawImage(image, 0, 0);
    context.restore();
  }

  async function createCardImage() {
    const template = new Image();
    template.src = posterTemplateUrl;
    const frameMask = new Image();
    frameMask.src = posterFrameMaskUrl;
    const portrait = new Image();
    portrait.src = photoUrl;
    await Promise.all([template.decode(), frameMask.decode(), portrait.decode()]);

    const width = template.naturalWidth;
    const height = template.naturalHeight;
    const frame = [
      {x: 38, y: 108},
      {x: 336, y: 84},
      {x: 403, y: 520},
      {x: 60, y: 559}
    ];
    const crop = document.createElement('canvas');
    crop.width = width;
    crop.height = height;
    const cropContext = crop.getContext('2d', {willReadFrequently: true});
    const frameWidth = ((frame[1].x - frame[0].x) + (frame[2].x - frame[3].x)) / 2;
    const frameHeight = ((frame[3].y - frame[0].y) + (frame[2].y - frame[1].y)) / 2;
    const targetRatio = frameWidth / frameHeight;
    const portraitRatio = portrait.naturalWidth / portrait.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = portrait.naturalWidth;
    let sourceHeight = portrait.naturalHeight;

    if (portraitRatio > targetRatio) {
      sourceWidth = portrait.naturalHeight * targetRatio;
      sourceX = (portrait.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = portrait.naturalWidth / targetRatio;
      sourceY = (portrait.naturalHeight - sourceHeight) / 2;
    }

    cropContext.drawImage(
      portrait,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, width, height
    );

    const warped = document.createElement('canvas');
    warped.width = width;
    warped.height = height;
    const warpedContext = warped.getContext('2d', {willReadFrequently: true});
    const sourceTopLeft = {x: 0, y: 0};
    const sourceTopRight = {x: width, y: 0};
    const sourceBottomRight = {x: width, y: height};
    const sourceBottomLeft = {x: 0, y: height};
    drawPhotoTriangle(
      warpedContext,
      crop,
      [sourceTopLeft, sourceTopRight, sourceBottomLeft],
      [frame[0], frame[1], frame[3]]
    );
    drawPhotoTriangle(
      warpedContext,
      crop,
      [sourceTopRight, sourceBottomRight, sourceBottomLeft],
      [frame[1], frame[2], frame[3]]
    );
    warpedContext.globalCompositeOperation = 'destination-in';
    warpedContext.drawImage(frameMask, 0, 0, width, height);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(template, 0, 0);
    context.drawImage(warped, 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('The keepsake card could not be exported.'));
      }, 'image/png');
    });
  }

  saveCard.addEventListener('click', async () => {
    saveCard.disabled = true;
    cardSaveNote.textContent = 'Preparing your keepsake…';
    try {
      const blob = cardImageBlob || await createCardImage();
      const file = new File([blob], 'anna-joseph-graduation-card.png', {type: 'image/png'});

      if (navigator.share && navigator.canShare?.({files: [file]})) {
        try {
          await navigator.share({files: [file], title: 'Anna’s graduation card'});
          cardSaveNote.textContent = 'Your graduation card is ready to keep.';
          cardLoveNote.hidden = false;
        } catch (error) {
          if (error.name === 'AbortError') {
            cardSaveNote.textContent = 'Your card is ready whenever you are.';
          } else {
            throw error;
          }
        }
      } else {
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = file.name;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        cardSaveNote.textContent = 'Your graduation card has been downloaded.';
        cardLoveNote.hidden = false;
      }
    } catch (error) {
      cardSaveNote.textContent = 'We could not save the card. Please try again.';
    } finally {
      saveCard.disabled = false;
    }
  });

  window.addEventListener('pagehide', stopCamera);
})();
