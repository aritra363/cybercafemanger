# Cyber Manager

A comprehensive management tool designed for Indian Cyber Cafes and small businesses. It provides a suite of features to manage sales, inventory, expenses, and gain insights through a real-time dashboard.

![Cyber Manager Screenshot](https://i.imgur.com/your-screenshot.png) <!-- Replace with a real screenshot URL -->

## ✨ Features

- **Dashboard**: Get a real-time overview of your business with key performance indicators (KPIs) like total sales, gross profit, expenses, and net profit. Visualize sales and profit trends over different time ranges (today, week, month, year).
- **Point of Sale (POS)**: A simple and efficient interface to process sales for both inventory items and ad-hoc services.
- **Inventory Management**: Keep track of your products, including stock levels, purchase prices, and selling prices. Receive low-stock alerts to manage your supplies effectively.
- **Sales History**: Review all past sales with detailed breakdowns, including cost of goods sold (COGS) and profit per sale.
- **Expense Tracking**: Record and categorize all your business expenses to get a clear picture of your net profit.
- **Customizable Themes**: Personalize the look and feel of the application with a variety of light and dark themes, as well as different design styles.
- **Data Export**: Export your dashboard, inventory, sales, and expenses data to XLSX (Excel) format for offline analysis or record-keeping.
- **Firebase Integration**: All data is securely stored and synced in real-time using Firebase Firestore.

## 🚀 Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: Tailwind CSS for utility-first styling.
- **Database**: Google Firebase (Firestore) for real-time data storage.
- **Charting**: Chart.js for data visualization.
- **Icons**: Lucide Icons.

## 🛠️ Setup and Installation

To get this project up and running on your local machine, follow these steps.

### Prerequisites

- A web server (like XAMPP, WAMP, or Python's `http.server`). The file paths in this project are set up for a standard web server environment.
- A Google Firebase account.

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/cyber-manager.git
cd cyber-manager
```

### 2. Set up a Web Server

Place the entire `cyber-manager` folder into your web server's root directory (e.g., `htdocs` for XAMPP).

### 3. Create a Firebase Project

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Click on "Add project" and follow the steps to create a new project.
3.  Once your project is created, go to the Project Settings (click the gear icon next to "Project Overview").
4.  In the "Your apps" section, click on the web icon (`</>`) to add a new web app.
5.  Register your app. You will be given a `firebaseConfig` object. Copy this object.

### 4. Configure Firebase Credentials

1.  Open the `js/firebase-config.js` file in the project.
2.  You will see a `window.CM.firebaseConfig` object with placeholder values.
3.  **Replace the placeholder values** with the configuration object you copied from your Firebase project.

    ```javascript
    // js/firebase-config.js

    // Replace these with YOUR Firebase project config
    window.CM.firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };
    ```

### 5. Set up Firestore Database

1.  In your Firebase project console, go to the "Firestore Database" section from the left-hand menu.
2.  Click "Create database".
3.  Start in **production mode**.
4.  Choose a Firestore location (e.g., `asia-south1`).
5.  Go to the **Rules** tab in Firestore and paste the following rules. This ensures that only authenticated users can read/write data (though this project currently doesn't implement user authentication, these are good practice).

    ```json
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // For simplicity, this allows reads and writes if a user is signed in.
        // For a real-world app, you would have more granular rules.
        match /{document=**} {
          allow read, write: if request.auth != null;
        }
      }
    }
    ```
    *Note: For initial testing without authentication, you can set the rules to `allow read, write: if true;` but this is **not recommended for production**.*

##  usage

1.  Start your web server (e.g., start Apache in XAMPP).
2.  Open your web browser and navigate to the project's URL (e.g., `http://localhost/cyber-manager`).
3.  The application should load, and you can start using the different modules via the sidebar navigation.
