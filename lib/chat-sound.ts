/* =========================================================
   BIRDSHOP CHAT NOTIFICATION SOUND

   Customer:
   Original BirdShop two-note chime.

   Admin:
   Exact same two-note chime, slightly stronger.

   No extra octave.
   No triangle layer.
   No different tone.
========================================================= */

let context:
  | AudioContext
  | null = null;

let unlocked =
  false;

/* =========================================================
   VOLUME
========================================================= */

/*
 * This is the storefront/customer volume you said sounds
 * perfect.
 */

const CUSTOMER_VOLUME_MULTIPLIER =
  4;

/*
 * Admin uses the SAME sound, only stronger.
 *
 * 1.35 = approximately 35% additional oscillator amplitude.
 */

const ADMIN_VOLUME_BOOST =
  1.35;

const FIRST_BASE_VOLUME =
  0.0329;

const SECOND_BASE_VOLUME =
  0.0298;

/* =========================================================
   AUDIO CONTEXT
========================================================= */

function getContext() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  if (!context) {
    context =
      new AudioContext();
  }

  return context;
}

/* =========================================================
   UNLOCK
========================================================= */

export async function unlockChatSound() {
  const audio =
    getContext();

  if (!audio) {
    return;
  }

  if (
    audio.state ===
    "suspended"
  ) {
    await audio.resume();
  }

  unlocked =
    audio.state ===
    "running";
}

/* =========================================================
   TONE
========================================================= */

function playTone(
  audio: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  volume: number
) {
  const oscillator =
    audio.createOscillator();

  const gain =
    audio.createGain();

  oscillator.type =
    "sine";

  oscillator.frequency
    .setValueAtTime(
      frequency,
      start
    );

  gain.gain
    .setValueAtTime(
      0.0001,
      start
    );

  gain.gain
    .exponentialRampToValueAtTime(
      volume,
      start + 0.018
    );

  gain.gain
    .exponentialRampToValueAtTime(
      0.0001,
      start + duration
    );

  oscillator.connect(
    gain
  );

  gain.connect(
    audio.destination
  );

  oscillator.start(
    start
  );

  oscillator.stop(
    start +
      duration +
      0.02
  );
}

/* =========================================================
   SHARED CHIME
========================================================= */

function playBirdShopChime(
  extraVolume:
    number
) {
  const audio =
    getContext();

  if (
    !audio ||
    !unlocked ||
    audio.state !==
      "running"
  ) {
    return false;
  }

  const now =
    audio.currentTime;

  const firstVolume =
    FIRST_BASE_VOLUME *
    CUSTOMER_VOLUME_MULTIPLIER *
    extraVolume;

  const secondVolume =
    SECOND_BASE_VOLUME *
    CUSTOMER_VOLUME_MULTIPLIER *
    extraVolume;

  playTone(
    audio,
    659.25,
    now,
    0.22,
    firstVolume
  );

  playTone(
    audio,
    880,
    now + 0.11,
    0.30,
    secondVolume
  );

  return true;
}

/* =========================================================
   CUSTOMER CHIME
========================================================= */

export function playChatChime() {
  return playBirdShopChime(
    1
  );
}

/* =========================================================
   ADMIN CHIME

   Exact same sound.
   Only louder.
========================================================= */

export function playAdminChatChime() {
  return playBirdShopChime(
    ADMIN_VOLUME_BOOST
  );
}