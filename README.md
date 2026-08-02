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


## PWA v2 fixes
- Planner is fully hidden until authentication succeeds.
- Login screen is fixed to the viewport and cannot scroll into the planner.
- Calendar date buttons use reset browser styling and centered text.
- Service-worker cache upgraded to v2.


## PWA v3 changes
- Added country creation button.
- Removed Dashboard and Reports from every country.
- Country workspaces now contain only Team Calendar, Manpower and Projects.
- Reduced mobile spacing, card sizes and control heights to minimise scrolling.
- Service-worker cache upgraded to v3.


## PWA v4 fix
- Countries heading and add-country button now use a two-column grid.
- The add button has fixed reserved space and cannot overlap the heading.
- Improved spacing on narrow mobile screens.
