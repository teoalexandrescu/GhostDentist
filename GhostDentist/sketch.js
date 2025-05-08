//Teodora Alexandrescu

let port;
let connectionButton, zeroButton;
let cursorX, cursorY;
let joystickSpeed = 0.03;
let swPressed = false;

let GameStates = Object.freeze({
  START: "start",
  PLAY: "play",
  ANGRY: "angry",
  END: "end"
});

let gameState = GameStates.START;
let score = 0;
let highScore = 0;
let time = 30;
let angryStartTime = 0;
let textPadding = 15;
let gameFont;
let teeth = [];
let toothCount = 16;
let cursedToothIndex;
let ghostSprite, angryGhostSprite, toothSprite, cobwebSprite, spiderSprite;
let startSound, endSound;
let audioButton, synth1, synth2, part1, seq1, gain1, panner, filt, noiseEnv, noise1, centerFreq;

function connect() {
  port.open('Arduino', 9600);
}

function zero() {
  if (port.opened()) {
    port.write('zero\n');
  }
}

function preload() {
  gameFont = loadFont("media/Creepster-Regular.ttf");
  ghostSprite = loadImage("media/ghost4.png");
  angryGhostSprite = loadImage("media/angryghost.png");
  toothSprite = loadImage("media/tooth.png");
  cobwebSprite = loadImage("media/cobweb.png");
  spiderSprite = loadImage("media/spiderghost.png");
}

function setup() {
  createCanvas(1000, 600);

  cursorX = width/2;
  cursorY = 230;

  port = createSerial();
  connectionButton = createButton('Connect');
  connectionButton.mousePressed(connect);

  zeroButton = createButton('Zero Joystick');
  zeroButton.mousePressed(zero);

  textFont(gameFont);
  imageMode(CENTER);

  audioButton = createButton("Start Audio");
  audioButton.position(width/2-50, height/100);
  audioButton.mousePressed(() => {
    if (Tone.context.state !== "running") {
      Tone.start().then(() => {
        console.log("Context has started");
      });
    }
  });

  startSound = new Tone.Player("media/gamestart.mp3").toDestination();
  endSound = new Tone.Player("media/gameover.mp3").toDestination();
  angrySound = new Tone.Player("media/scream.mp3").toDestination();
  startSound.autostart = false;
  endSound.autostart = false;
  angrySound.autostart = false;

  Tone.Transport.timeSignature = [3, 4];
  Tone.Transport.bpm.value = 90;
  synth1 = new Tone.AMSynth({
  modulationIndex: 10,
  harmonicity: 1.5,
  envelope: {attack: 0.4,
             decay: 0.2,
             sustain: 0.5,
             release: 1.2 },
  modulation: {type: "sine"},
  modulationEnvelope: {attack: 0.3,
                       decay: 0.1,
                       sustain: 0.6,
                       release: 0.5 }
  }).toDestination();

  synth2 = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.6, 
              decay: 0.2, 
              sustain: 0.4, 
              release: 1.5 }
  }).toDestination();

  part1 = new Tone.Part(((time, value) => {
    synth1.triggerAttackRelease(value.note, value.dur, time);
  }), 
  [
    { time: 0, note: "C4", dur: "4n" },
    { time: "0:1", note: "D#4", dur: "8n" },
    { time: "0:2", note: "F4", dur: "8n" },
    { time: "1:0", note: "G4", dur: "4n" },
    { time: "1:2", note: "A3", dur: "8n" },
    { time: "2:0", note: "Bb4", dur: "2n" },
    { time: "3:0", note: "D4", dur: "4n" },
    { time: "3:2", note: "F4", dur: "8n" }
  ]);
  part1.loop = true;
  part1.loopEnd = "4m";
  seq1 = new Tone.Sequence((time, note) => {
    synth2.triggerAttackRelease(note, "8n", time);
  }, ["C4", "Eb4", "G4", "Bb4", "F4", "Ab4", "D4", "C5", "Bb4", "G4",
     "Eb4", "F4", "C4", "D4", "F4", "E4"], "8n"); 

  seq1.mute = true;
  part1.mute = true;

  const reverb = new Tone.Reverb({ decay: 0.5, wet: 0.3 }).toDestination();
  synth2.connect(reverb);
  gain1 = new Tone.Gain().toDestination();
  panner = new Tone.Panner(-0.2).connect(gain1);
  noiseEnv = new Tone.AmplitudeEnvelope({
    attack: 2,
    decay: 0.4,
    sustain: 0.6,
    release: 3
  }).connect(panner);
  centerFreq = map(height / 2, 0, height, 4000, 1500, true);
  filt = new Tone.Filter(700, "lowpass").connect(noiseEnv);
  noise1 = new Tone.Noise("brown").start().connect(filt); 
}

function draw() {
  background(8, 15, 45); 
  fill(246, 235, 158);
  ellipse(60, 60, 80, 80); 
  image(cobwebSprite, 50, 400, 100, 100); 
  image(cobwebSprite, 300, 50, 100, 100); 
  image(cobwebSprite, 900, 540, 100, 100); 
  image(spiderSprite, 75, 430, 80, 80); 
  image(spiderSprite, 900, 530, 85, 85); 

  let str = port.readUntil('\n');
  if (str !== "") {
    const values = str.trim().split(',');
    if (values.length === 3) {
      let x = Number(values[0]);
      let y = Number(values[1]);
      let sw = Number(values[2]);

      if (!isNaN(x) && !isNaN(y)) {
        cursorX = lerp(cursorX, cursorX + x * joystickSpeed, 0.2); 
        cursorY = lerp(cursorY, cursorY + y * joystickSpeed, 0.2);
      }
      cursorX = constrain(cursorX, 0, width);
      cursorY = constrain(cursorY, 0, height);

      if (sw === 0 && !swPressed) {
        swPressed = true;
        for (let i = 0; i < teeth.length; i++) {
          if (teeth[i].checkPress(cursorX, cursorY)) {
            if (teeth[i].isCursed) {
              triggerAngryGhost();
              if (port.opened()) {
                port.write("red_led_on\n");
              }
            } else {
              score++;
              if (port.opened()) {
                port.write("green_led_on\n");
              }
            }
            break;
          }
        }
      } else if (sw === 1) {
        swPressed = false;
      }
    }
  }

  switch (gameState) {
    case GameStates.START:
      textAlign(CENTER, CENTER);
      fill(174, 26, 19);
      textSize(50);
      text("Press ENTER to Start", width/2, height/2);
      break;

    case GameStates.PLAY:
      image(ghostSprite, width/2, height/2, 600, 600);
      for (let tooth of teeth) {
        tooth.draw(tooth.x, tooth.y);
      }
      textAlign(LEFT, TOP);
      fill(174, 26, 19);
      textSize(35);
      text("Score: " + score, textPadding, textPadding);

      textAlign(RIGHT, TOP);
      text("Time: " + Math.ceil(time), width - textPadding, textPadding);

      time -= deltaTime / 1000;
      if (time <= 0) {
        triggerAngryGhost();
      }

      fill(0);
      circle(cursorX, cursorY, 25);
      break;

    case GameStates.ANGRY:
      image(angryGhostSprite, width/2, height/2, 600, 600);
      if (millis() - angryStartTime >= 3000) {
        gameState = GameStates.END;
        endSound.start();
      }
      break;

    case GameStates.END:
      textAlign(CENTER, CENTER);
      fill(174, 26, 19);
      textSize(50);
      text("Game Over!", width/2, height/2 - 50);
      text("Score: " + score, width/2, height/2);
      if (score > highScore)
        highScore = score;
      text("High Score: " + highScore, width/2, height/2 + 50);
      part1.mute = true;
      seq1.mute = true;
      part1.stop();
      seq1.stop();
      break;
  }
}

function keyPressed() {
  if (Tone.context.state !== "running") {
    Tone.start().then(() => {
      Tone.Transport.start();
    });
  } else if (Tone.Transport.state !== "started") {
    Tone.Transport.start();
  }

  switch (gameState) {
    case GameStates.START:
      if (keyCode === ENTER) {
        gameState = GameStates.PLAY;
        score = 0;
        time = 30;
        startSound.start();
        part1.mute = false;
        seq1.mute = false;
        part1.start();
        seq1.start();

        teeth = [];
        cursedToothIndex = floor(random(toothCount));
        let teethPerRow = toothCount / 2;
        let centerX = width / 2;
        let spacing = 42;
        let amplitude = 35;
        let waveStretch = Math.PI;
        let topRowTeeth = 320;
        let bottomRowTeeth = 370;

        for (let i = 0; i < toothCount; i++) {
          let isTopRow = i < teethPerRow;
          let indexInRow = i % teethPerRow;
          let offsetFromCenter = indexInRow - (teethPerRow - 1) / 2;
          let x = centerX + offsetFromCenter * spacing;
          let t = indexInRow / (teethPerRow - 1);
          let yOffset = amplitude * Math.sin(t * waveStretch);
          let y = isTopRow ? topRowTeeth - yOffset : bottomRowTeeth + yOffset;
          teeth.push(new Tooth(x, y, i === cursedToothIndex, !isTopRow));
        }
      }
      break;
    case GameStates.PLAY:
      break;
    case GameStates.END:
      break;
  }
}

function triggerAngryGhost() {
  gameState = GameStates.ANGRY;
  angryStartTime = millis();
  part1.mute = true;
  seq1.mute = true;
  part1.stop();
  seq1.stop();
  angrySound.start();
  if (port.opened()) {
    port.write("game_over\n");  
  }
}

class Tooth {
  constructor(x, y, isCursed, flip = false) {
    this.x = x;
    this.y = y;
    this.isCursed = isCursed;
    this.size = 80; 
    this.flip = flip;
    this.isClicked = false; 
  }

  draw(x, y) {
    if (this.isClicked) return;  
    push();
    translate(x, y);
    let s = (this.flip) ? -1 : 1;
    scale(1, s);
    image(toothSprite, 0, 0, this.size, this.size);
    pop();
  }
  
  checkPress(px = cursorX, py = cursorY) {
    let d = dist(this.x, this.y, px, py);
    if (d < this.size / 2) {
      this.isClicked = true;  
      return true;  
    }
    return false;
  }
}