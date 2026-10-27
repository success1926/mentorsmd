# Google Sheet copy of form submissions: setup

Every **Contact message**, **Waitlist signup** ("Tell me when mentors join") and **Mentor application** on the website can also be added to a Google Sheet, with one tab per form. Admin -> Leads stays the main record; the Sheet is an extra copy the team can sort, filter and share.

It's off until the two settings in step 5 are added. If Google is ever slow or down, forms still work normally; the row just doesn't reach the Sheet (the error shows in the Vercel logs).

About 15 minutes. You need the Google account that should own the Sheet, and access to the MentorsMD project on Vercel.

## 1. Create the Sheet

1. Go to [sheets.new](https://sheets.new) (signed in with the Google account that should own it).
2. Name it, for example **MentorsMD website forms**.
3. You don't need to add any tabs or headings. The first time each form is sent, its tab (**Contact messages**, **Waitlist**, **Mentor applications**) is created with its own headings, plus **Status**, **Assigned to** and **Notes** columns for the team.

## 2. Paste the script

1. In the Sheet, open **Extensions -> Apps Script**. A new tab opens with a file called `Code.gs`.
2. Delete everything in `Code.gs`.
3. Open `scripts/google-sheet-apps-script.gs` from the MentorsMD code (on GitHub: the repository -> `scripts` folder -> `google-sheet-apps-script.gs` -> the copy button), and paste the whole thing into `Code.gs`.
4. Name the project at the top left, for example **MentorsMD forms**.

## 3. Choose a secret phrase

The secret stops anyone else from adding rows to your Sheet.

1. Make up a long random phrase, at least 30 characters, with no spaces. A password manager's "generate password" works well (letters and numbers only is safest).
2. In `Code.gs`, find this line near the top:
   `var SECRET = "CHANGE-ME-to-the-same-long-phrase-you-put-in-Vercel";`
   and replace the text between the quotes with your phrase. Keep the quotes.
3. Press the **Save** icon (or Cmd+S / Ctrl+S).
4. Keep the phrase somewhere safe for step 5. Don't email it or put it in a shared doc.

## 4. Deploy it as a web app

1. Top right: **Deploy -> New deployment**.
2. Next to "Select type", click the gear icon and choose **Web app**.
3. Fill in:
   - Description: `MentorsMD forms`
   - Execute as: **Me**
   - Who has access: **Anyone** (the website isn't signed in to Google; the secret phrase is what protects it)
4. Click **Deploy**.
5. Google asks you to **Authorize access**. Pick your account. If you see "Google hasn't verified this app", click **Advanced -> Go to MentorsMD forms (unsafe)**. This is normal for your own script: it's only asking to edit this one Sheet. Click **Allow**.
6. Copy the **Web app URL** (it starts with `https://script.google.com/macros/s/` and ends with `/exec`).

## 5. Add the two settings in Vercel

1. Open [vercel.com](https://vercel.com) -> the MentorsMD project -> **Settings -> Environment Variables**.
2. Add:
   - Name `GOOGLE_SHEET_WEBHOOK_URL`, value: the Web app URL from step 4.
   - Name `GOOGLE_SHEET_SECRET`, value: your secret phrase from step 3. Tick **Sensitive**.
3. Environments: tick **Production** only if you want only real submissions in the Sheet. (Tick **Preview** too if you want test submissions from preview sites as well; they'd land in the same Sheet.)
4. Save, then go to **Deployments**, open the latest Production deployment's **...** menu and press **Redeploy**, so the site picks up the new settings.

## 6. Test it

1. On the live site, send a message from the **Contact** page (use your own email and write "Test" in the message).
2. Within a few seconds a **Contact messages** tab should appear in the Sheet with your row.
3. Try the waitlist box on the **Mentors** page too, if you like.
4. Delete the test rows from the Sheet (and mark the test lead Done in Admin -> Leads).

### If nothing appears

- Check both settings are spelled exactly as above and you redeployed after adding them.
- Check the phrase in Vercel and in `Code.gs` are exactly the same (no extra spaces or quotes).
- In Apps Script, open **Executions** (left sidebar, the list icon). A failed run shows the reason there.
- In Vercel, open the project's **Logs** and search for `Google Sheet`.

## Changing the script later

If you edit `Code.gs` (for example to change the secret), the website keeps using the old version until you publish the new one: **Deploy -> Manage deployments -> pencil icon -> Version: New version -> Deploy**. The Web app URL stays the same, so nothing changes in Vercel unless you changed the secret.

## Turning it off

Delete `GOOGLE_SHEET_WEBHOOK_URL` (or `GOOGLE_SHEET_SECRET`) in Vercel and redeploy. Nothing else on the site changes.

## Good to know

- Résumés aren't copied to Google. The Mentor applications tab has an admin-only link to download each résumé from MentorsMD.
- Anything typed into a form that starts with `=`, `+`, `-` or `@` is saved as plain text, so a form can't put a formula into the Sheet.
- Someone who joins the waitlist twice gets two rows in the Sheet (the site itself keeps one per email).
- The Sheet holds people's names, emails and phone numbers: share it only with the team.
