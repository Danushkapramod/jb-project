#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>

// =========================================================================
// 🌐 SERVER CONFIGURATION
// Update 'server_url' with your active Cloudflare Tunnel URL or Local IP:
// Example Cloudflare Tunnel : "https://announcements-assignment-cycling-industrial.trycloudflare.com"
// Example Local WiFi IP     : "http://192.168.1.100:3000"
// (IMPORTANT: Do NOT add a trailing slash at the end)
// =========================================================================
const char* server_url = "https://announcements-assignment-cycling-industrial.trycloudflare.com";

// Location identifier of this ESP32 terminal/gadget in the field
const char* gadget_location = "Field Station Plot 1";

// WiFi Network Credentials (Wokwi uses "Wokwi-GUEST" with empty password)
const char* ssid = "Wokwi-GUEST";
const char* pass = "";

// =========================================================================
// 📟 LCD & KEYPAD HARDWARE SETUP
// =========================================================================
LiquidCrystal_I2C lcd(0x27, 20, 4);

const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {12, 14, 27, 26}; 
byte colPins[COLS] = {25, 33, 32, 18}; // Matches Wokwi diagram.json D18
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// =========================================================================
// 🔄 STATE MACHINE VARIABLES
// =========================================================================
enum SystemState { SELECT_MACHINE, ENTER_PHONE, ENTER_DATE, SUBMIT, WAITING_RESPONSE };
SystemState currentState = SELECT_MACHINE;

String selectedMachine = "";
String phoneNumber = "";
String bookingDate = "";
String currentDispatchId = "";

unsigned long lastPollTime = 0;
const unsigned long POLL_INTERVAL = 2500; // Check driver status every 2.5s

// =========================================================================
// 📺 LCD HELPER FUNCTIONS
// =========================================================================
void updateLine(int row, String text) {
  lcd.setCursor(0, row);
  lcd.print(text);
  for (int i = text.length(); i < 20; i++) {
    lcd.print(" ");
  }
}

void showLCD(String l1, String l2, String l3, String l4) {
  updateLine(0, l1);
  updateLine(1, l2);
  updateLine(2, l3);
  updateLine(3, l4);
}

// Lightweight JSON value parser (zero external library dependency)
String extractJsonValue(String json, String key) {
  String pattern = "\"" + key + "\":\"";
  int startIdx = json.indexOf(pattern);
  if (startIdx != -1) {
    startIdx += pattern.length();
    int endIdx = json.indexOf("\"", startIdx);
    if (endIdx != -1) {
      return json.substring(startIdx, endIdx);
    }
  }

  // Fallback for non-quoted numeric/boolean values
  pattern = "\"" + key + "\":";
  startIdx = json.indexOf(pattern);
  if (startIdx != -1) {
    startIdx += pattern.length();
    int endIdx = json.indexOf(",", startIdx);
    if (endIdx == -1) endIdx = json.indexOf("}", startIdx);
    if (endIdx != -1) {
      String val = json.substring(startIdx, endIdx);
      val.trim();
      val.replace("\"", "");
      return val;
    }
  }
  return "";
}

// Reset System back to machinery selection screen
void resetSystem() {
  currentState = SELECT_MACHINE;
  selectedMachine = "";
  phoneNumber = "";
  bookingDate = "";
  currentDispatchId = "";
  
  lcd.clear();
  delay(10);
  
  showLCD("=== AGRI-CONNECT ===", "1:Tractor 2:Harvest", "3:Tiller  4:WaterP", "5:Rotavator Select:");
}

// =========================================================================
// 🚀 HTTP API CALL: Broadcast Dispatch to Platform
// =========================================================================
void sendDispatchRequest() {
  if (WiFi.status() != WL_CONNECTED) {
    showLCD("WIFI ERROR!", "Reconnecting WiFi", "Please wait...", "");
    WiFi.reconnect();
    delay(2000);
    return;
  }

  showLCD("SENDING REQUEST...", "Connecting Server...", "Broadcasting Job...", "");

  // Convert 4-digit date DDMM (e.g. 1509) to ISO YYYY-MM-DD
  String formattedDate = bookingDate;
  if (bookingDate.length() == 4) {
    formattedDate = "2026-" + bookingDate.substring(2, 4) + "-" + bookingDate.substring(0, 2);
  }

  HTTPClient http;
  String endpoint = String(server_url) + "/api/dispatch";
  http.begin(endpoint);
  http.addHeader("Content-Type", "application/json");

  // Construct JSON payload matching backend API requirements
  String jsonPayload = "{\"requesterPhone\":\"" + phoneNumber + "\","
                       "\"vehicleType\":\"" + selectedMachine + "\","
                       "\"date\":\"" + formattedDate + "\","
                       "\"location\":\"" + String(gadget_location) + "\","
                       "\"notes\":\"Requested via ESP32 Hardware Gadget\"}";

  Serial.println("\n-------------------------------------------");
  Serial.println("POST " + endpoint);
  Serial.println("Payload: " + jsonPayload);

  int httpCode = http.POST(jsonPayload);
  Serial.print("HTTP Response Code: ");
  Serial.println(httpCode);

  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    Serial.println("Server Response: " + response);

    currentDispatchId = extractJsonValue(response, "id");
    Serial.println("Created Dispatch ID: " + currentDispatchId);

    showLCD("REQUEST BROADCAST!", "ID: " + currentDispatchId.substring(0, 16), "Waiting for Driver", "Press C to Cancel");
    currentState = WAITING_RESPONSE;
    lastPollTime = millis();
  } else {
    String errorMsg = "HTTP Error: " + String(httpCode);
    if (httpCode < 0) {
      errorMsg = "Connection Refused";
    }
    showLCD("DISPATCH FAILED!", errorMsg, "Check Tunnel URL", "Press C to restart");
    Serial.println("Failed to dispatch request to " + endpoint);
    delay(4000);
    resetSystem();
  }
  http.end();
}

// =========================================================================
// ❌ HTTP API CALL: Cancel Pending Dispatch on Server
// =========================================================================
void cancelCurrentDispatch() {
  if (currentDispatchId != "" && WiFi.status() == WL_CONNECTED) {
    showLCD("CANCELLING TASK...", "ID: " + currentDispatchId.substring(0, 16), "Notifying server...", "Please wait...");
    HTTPClient http;
    String endpoint = String(server_url) + "/api/dispatch/" + currentDispatchId + "/delete";
    http.begin(endpoint);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(2500);
    int httpCode = http.POST("{}");
    Serial.print("Cancel dispatch HTTP response: ");
    Serial.println(httpCode);
    http.end();
  }
}

// =========================================================================
// 🔍 HTTP API CALL: Poll Driver Approval Status
// =========================================================================
void checkDriverApproval() {
  if (WiFi.status() != WL_CONNECTED || currentState != WAITING_RESPONSE || currentDispatchId == "") {
    return;
  }

  HTTPClient http;
  String statusUrl = String(server_url) + "/api/dispatch/" + currentDispatchId + "/status";
  http.begin(statusUrl);
  http.addHeader("Connection", "close");

  int httpCode = http.GET();

  if (httpCode == 200) {
    String response = http.getString();
    String status = extractJsonValue(response, "status");

    if (status == "APPROVED") {
      String driverName = extractJsonValue(response, "driverName");
      String driverPhone = extractJsonValue(response, "driverPhone");
      String regNo = extractJsonValue(response, "vehicleRegNo");

      Serial.println("\n===========================================");
      Serial.println(">>> BOOKING APPROVED!");
      Serial.println("Driver: " + driverName);
      Serial.println("Phone:  " + driverPhone);
      Serial.println("Plate:  " + regNo);
      Serial.println("===========================================\n");

      showLCD("STATUS: APPROVED!", "Driver: " + driverName, "Phone: " + driverPhone, "WhatsApp Sent!");
      delay(6000);
      resetSystem();
      http.end();
      return;
    } else if (status == "NOT_FOUND") {
      showLCD("STATUS: CANCELLED", "Request was removed", "from admin console", "");
      delay(3000);
      resetSystem();
      http.end();
      return;
    }
  }
  http.end();
}

// =========================================================================
// ⚙️ ARDUINO SETUP
// =========================================================================
void setup() {
  Serial.begin(115200);
  delay(100);
  
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  
  showLCD("=== AGRI-CONNECT ===", "Connecting WiFi...", "Please wait...", "");

  WiFi.begin(ssid, pass);
  int retryCount = 0;
  while (WiFi.status() != WL_CONNECTED && retryCount < 30) {
    delay(250);
    Serial.print(".");
    retryCount++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
    showLCD("=== AGRI-CONNECT ===", "WiFi Connected!", "Starting Engine...", "");
    delay(1000);
  } else {
    Serial.println("\nWiFi Connection Failed.");
    showLCD("=== AGRI-CONNECT ===", "WiFi Conn Failed", "Check Simulator", "");
    delay(2000);
  }

  resetSystem();
}

// =========================================================================
// 🔁 MAIN LOOP
// =========================================================================
void loop() {
  char key = keypad.getKey();

  if (key) {
    // ❌ 'C' BUTTON: CANCEL current task and return to main menu from ANY screen
    if (key == 'C') {
      if (currentState == WAITING_RESPONSE) {
        cancelCurrentDispatch();
        showLCD("REQUEST CANCELLED", "Returning to menu", "Please wait...", "");
        delay(1200);
      } else if (currentState != SELECT_MACHINE) {
        showLCD("TASK CANCELLED", "Returning to menu...", "", "");
        delay(800);
      }
      resetSystem();
      return;
    }

    // In WAITING_RESPONSE mode, pressing 'B', '*', or 'D' also cancels back to main menu
    if ((key == 'B' || key == '*' || key == 'D') && currentState == WAITING_RESPONSE) {
      cancelCurrentDispatch();
      showLCD("REQUEST CANCELLED", "Returning to menu", "Please wait...", "");
      delay(1200);
      resetSystem();
      return;
    }

    switch (currentState) {
      case SELECT_MACHINE:
        selectedMachine = "";
        if (key == '1') selectedMachine = "Tractor";
        else if (key == '2') selectedMachine = "Harvester";
        else if (key == '3') selectedMachine = "PowerTiller";
        else if (key == '4') selectedMachine = "WaterPump";
        else if (key == '5') selectedMachine = "Rotavator";

        if (selectedMachine != "") {
          phoneNumber = "";
          currentState = ENTER_PHONE;
          showLCD("Mach: " + selectedMachine, "Enter Phone No:", "Phone: ", "#:Next *:Del B:Back");
        }
        break;

      case ENTER_PHONE:
        if (key == '#') {
          if (phoneNumber.length() >= 9) {
            bookingDate = "";
            currentState = ENTER_DATE;
            showLCD("Phone: " + phoneNumber, "Enter Date (DDMM):", "Date: ", "#:Send *:Del B:Back");
          } else {
            showLCD("Mach: " + selectedMachine, "Min 9 digits needed", "Phone: " + phoneNumber, "#:Next *:Del B:Back");
          }
        } else if (key == 'B') {
          // 🔙 'B' BUTTON: Go BACK to Machine Selection menu
          resetSystem();
        } else if (key == '*') {
          // Backspace / Del support
          if (phoneNumber.length() > 0) {
            phoneNumber.remove(phoneNumber.length() - 1);
            showLCD("Mach: " + selectedMachine, "Enter Phone No:", "Phone: " + phoneNumber, "#:Next *:Del B:Back");
          } else {
            resetSystem();
          }
        } else if (key >= '0' && key <= '9') {
          if (phoneNumber.length() < 12) {
            phoneNumber += key;
            showLCD("Mach: " + selectedMachine, "Enter Phone No:", "Phone: " + phoneNumber, "#:Next *:Del B:Back");
          }
        }
        break;

      case ENTER_DATE:
        if (key == '#') {
          if (bookingDate.length() == 4) {
            currentState = SUBMIT;
          } else {
            showLCD("Phone: " + phoneNumber, "Need 4 digits (DDMM)", "Date: " + bookingDate, "#:Send *:Del B:Back");
          }
        } else if (key == 'B') {
          // 🔙 'B' BUTTON: Go BACK to Enter Phone screen (phone number preserved)
          bookingDate = "";
          currentState = ENTER_PHONE;
          showLCD("Mach: " + selectedMachine, "Enter Phone No:", "Phone: " + phoneNumber, "#:Next *:Del B:Back");
        } else if (key == '*') {
          // Backspace / Del support
          if (bookingDate.length() > 0) {
            bookingDate.remove(bookingDate.length() - 1);
            showLCD("Phone: " + phoneNumber, "Enter Date (DDMM):", "Date: " + bookingDate, "#:Send *:Del B:Back");
          } else {
            currentState = ENTER_PHONE;
            showLCD("Mach: " + selectedMachine, "Enter Phone No:", "Phone: " + phoneNumber, "#:Next *:Del B:Back");
          }
        } else if (key >= '0' && key <= '9') {
          if (bookingDate.length() < 4) {
            bookingDate += key;
            showLCD("Phone: " + phoneNumber, "Enter Date (DDMM):", "Date: " + bookingDate, "#:Send *:Del B:Back");
          }
        }
        break;

      default:
        break;
    }
  }

  // Trigger HTTP POST request when SUBMIT state is reached
  if (currentState == SUBMIT) {
    sendDispatchRequest();
  }

  // Poll driver approval status regularly
  if (currentState == WAITING_RESPONSE && millis() - lastPollTime > POLL_INTERVAL) {
    checkDriverApproval();
    lastPollTime = millis();
  }
}