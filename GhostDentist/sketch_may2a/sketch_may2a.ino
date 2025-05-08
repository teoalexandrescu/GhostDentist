//Teodora Alexandrescu 

const int JOYX_PIN = A0;  
const int JOYY_PIN = A1;  
const int SW_PIN = 2;     
const int RED_LED_PIN = 11;   
const int GREEN_LED_PIN = 12; 

const int NUM_READINGS = 10;  

struct AxisReadings {
  int readIndex;
  int readings[NUM_READINGS];
  float total = 0;
  int average = 0;
  int zeroed;

} xAxisReadings, yAxisReadings;

bool zeroing = false;
bool ready = false;
bool gameOver = false;

unsigned long gameOverStartTime = 0;
unsigned long lastFlashTime = 0;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(9600);

  pinMode(SW_PIN, INPUT_PULLUP);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);

  for (int i = 0; i < NUM_READINGS; i++) {
    xAxisReadings.readings[i] = yAxisReadings.readings[i] = 0;
  }
}

void loop() {
  // put your main code here, to run repeatedly:
  int xValue = analogRead(JOYX_PIN);
  int yValue = analogRead(JOYY_PIN);

  int swValue = !digitalRead(SW_PIN);

  smoothAxis(&xAxisReadings, xValue);
  smoothAxis(&yAxisReadings, yValue);

  if (Serial.available() > 0) {
    String msg = Serial.readStringUntil('\n');
    if (msg == "zero") {
      zeroing = true;
    } else if (msg == "green_led_on") {
      digitalWrite(GREEN_LED_PIN, HIGH);
      digitalWrite(RED_LED_PIN, LOW);
    } else if (msg == "red_led_on") {
      digitalWrite(RED_LED_PIN, HIGH);
      digitalWrite(GREEN_LED_PIN, LOW);
    } else if (msg == "game_over") {
      gameOver = true;
      gameOverStartTime = millis();         
      lastFlashTime = millis();    }
  }

  if (gameOver) {
    unsigned long currentTime = millis();
    if (currentTime - gameOverStartTime < 5000) {
      if (currentTime - lastFlashTime >= 300) {  
        digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
        digitalWrite(GREEN_LED_PIN, !digitalRead(GREEN_LED_PIN));
        lastFlashTime = currentTime;
      }
    } else {
      digitalWrite(RED_LED_PIN, LOW);
      digitalWrite(GREEN_LED_PIN, LOW);
      gameOver = false;
    }
  }

  if (!ready && millis() > 2000) {
    xAxisReadings.zeroed = xAxisReadings.average;
    yAxisReadings.zeroed = yAxisReadings.average;
    ready = true;
  }

  if (ready) {
    Serial.print(xAxisReadings.average - xAxisReadings.zeroed);
    Serial.print(",");
    Serial.print(yAxisReadings.average - yAxisReadings.zeroed);
    Serial.print(",");
    Serial.println(swValue);
  }

  delay(16);
}

void smoothAxis(AxisReadings *readings, int newValue) {
  int index = readings->readIndex;
  readings->total = readings->total - readings->readings[index];  
  readings->readings[index] = newValue;  
  readings->total += newValue;  
    readings->readIndex = readings->readIndex + 1;

  if (readings->readIndex >= NUM_READINGS)
    readings->readIndex = 0;

  readings->average = round(readings->total / NUM_READINGS);
}