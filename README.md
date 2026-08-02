# FieldFlow Team Planner PWA

## Included
- Firebase email/password login
- Firestore shared live data
- Country-first workspaces
- Dashboard, Calendar, Manpower, Projects and Reports per country
- Month and Day calendar views
- Grouped project balloons
- Mobile drawer and responsive desktop layout
- Installable Progressive Web App
- Offline shell caching
- 48 non-Singapore employees seeded from the uploaded master list

## Firestore document
`planner/pwa-v1`

## Required Firestore rules
```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /planner/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Deployment
Copy all files and folders into the GitHub repository root, then:

```bash
git add .
git commit -m "Deploy FieldFlow PWA"
git push
```

## Install on mobile
Open the site in Safari or Chrome and choose **Add to Home Screen**.
