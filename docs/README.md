# Ιστοσελίδα «Διαχείριση Υλικού»

Στατική, responsive ιστοσελίδα για GitHub Pages, χωρίς framework ή διαδικασία
μεταγλώττισης. Παρουσιάζει τις βασικές δυνατότητες της εφαρμογής και οδηγεί
τον επισκέπτη στο πιο πρόσφατο GitHub Release για τη λήψη του installer.

## Δημοσίευση στο GitHub

1. Δημιουργήστε ένα repository στο GitHub και ανεβάστε ολόκληρο το έργο.
2. Ανοίξτε **Settings → Pages**.
3. Στο **Build and deployment → Source**, επιλέξτε **GitHub Actions**.
4. Το workflow `.github/workflows/pages.yml` θα δημοσιεύσει αυτόματα τον
   φάκελο `docs/` σε κάθε αλλαγή στον κλάδο `main` ή `master`.

Η διεύθυνση θα είναι συνήθως:

```text
https://USERNAME.github.io/REPOSITORY/
```

## Διάθεση του installer

1. Ανοίξτε την ενότητα **Releases** του repository.
2. Δημιουργήστε release με tag `v0.13.272`.
3. Επισυνάψτε και τα τέσσερα αρχεία, διατηρώντας ακριβώς τις παρακάτω
   ονομασίες:

```text
diaxeirisi-Ylikoy-Setup-0.13.272.exe
diaxeirisi-Ylikoy-Windows-10-11-x86-Setup-0.13.272.exe
diaxeirisi-Ylikoy-Windows-7-Legacy-Setup-0.13.272.exe
diaxeirisi-Ylikoy-Windows-7-SP1-x86-Legacy-Setup-0.13.272.exe
```

Η ιστοσελίδα αναγνωρίζει αυτόματα το repository από τη διεύθυνση GitHub
Pages και τα κουμπιά λήψης οδηγούν στα αντίστοιχα αρχεία του τελευταίου
διαθέσιμου release.

Για custom domain, συμπληρώστε στο `index.html`:

```html
<html lang="el" data-github-repository="USERNAME/REPOSITORY">
```

## Τοπική προεπισκόπηση

Από τη ρίζα του έργου:

```powershell
python -m http.server 8080 --directory docs
```

και έπειτα ανοίξτε `http://localhost:8080`.
