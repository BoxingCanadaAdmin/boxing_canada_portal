# Boxing Canada Portal: installation and operation

Version 0.2.1

## What this plugin does

The plugin turns a WordPress site into the Boxing Canada National Portal:

- **Display:** the portal runs full-screen on its own page, with its own design, so it doesn't depend on the theme.
- **Storage:** all portal data lives in the WordPress database, in the tables `wp_bcp_records` and `wp_bcp_seq`.
- **Sign-in:** members sign in with WordPress accounts. Passwords, sessions and "Forgot your password?" are handled by WordPress.
- **The server enforces access.** Every record is filtered before it leaves the server, and every change is checked before it is saved. Examples:
  - a boxer receives only their own medical records;
  - coaches receive full records only for boxers who chose them;
  - club managers and officials receive readiness statuses, not clinical details;
  - only medical practitioners and PTSO administrators can record examinations.

## 1. Try it on a test site

1. Use a **separate** WordPress installation, not boxingcanada.org itself. A staging site or a new subdomain such as `portal-test.boxingcanada.org` both work.
2. Go to **Plugins › Add New › Upload Plugin**, choose `boxing-canada-portal.zip`, then **Install** and **Activate**.
3. Activation does three things:
   - creates a page called **Portal** (`/portal/`);
   - loads the fictional demo data;
   - creates demo sign-in accounts. The password for all of them is `Password123!`.
4. Open `/portal/`. The sign-in page shows the demo account cards, and the "Quick role demo" bar lets testers switch roles.
5. Settings and data tools are under **Tools › Boxing Canada Portal**.

Each tester can use a different demo account at the same time. Everyone sees the same shared data, which refreshes every few seconds.

## 2. Go live at portal.boxingcanada.org

1. **Hosting:** a server with PHP 8.1 or later, MySQL or MariaDB, HTTPS, daily backups and real cron. See the hosting notes below.
2. **WordPress:** install a fresh copy at `portal.boxingcanada.org`, then this plugin. Add only what's needed:
   - an SMTP or email-delivery plugin;
   - a two-factor sign-in plugin for administrators;
   - a backup plugin.
3. In **Tools › Boxing Canada Portal**:
   1. **Download backup** (habit worth forming).
   2. **Empty the portal.** This deletes the demo data and keeps reference data such as the certification pathways.
   3. **Untick Test mode**, tick **Make it this site's home page**, and save. The portal then uses today's date, and the demo cards and role switcher disappear.
   4. **Make me an NSO Administrator** to link your own WordPress account to the portal.
4. Sign in to the portal and set up:
   - organization pages, Trackie links and Safe Sport contacts;
   - documents;
   - club managers.
5. Bring members in with **Members & Approvals › Import from Trackie**. Invited members get an activation code and set their own password.
6. Turn on **Send portal emails** once real members are in, and test with your own address first.

### Creating other administrators

- **PTSO administrators:** an NSO administrator sets a member's role to PTSO Administrator in **Edit account**.
- **NSO administrators:** only NSO administrators can create them.
- **WordPress staff:** to link a staff member's own WordPress login to an existing member record, use **Link another WordPress user to a member**.

## 3. Day-to-day operation

- **Backups:**
  - Tools › Boxing Canada Portal › **Download backup** exports the whole portal as JSON. It contains personal and medical information, so store it securely.
  - Hosting backups of the database are still needed.
- **Restoring:** **Restore a backup** replaces all portal data with a backup file.
- **Updates:** the plugin updates itself from the GitHub releases of BoxingCanadaAdmin/boxing_canada_portal (see section 7). Data is kept. You can still update by hand by uploading a new zip.
- **Deleting the plugin:** data is kept. To remove it completely, delete the two `wp_bcp_` tables after taking a backup.

## 4. How it works (for a developer taking over)

| Part | File |
|---|---|
| Plugin start-up, settings | `boxing-canada-portal.php` |
| Record storage and revisions | `includes/class-bcp-store.php` |
| Who may read and change what | `includes/class-bcp-access.php` |
| WordPress accounts linked to members | `includes/class-bcp-accounts.php` |
| REST API (`/wp-json/bcp/v1/`) | `includes/class-bcp-rest.php` |
| Full-screen page, shortcode | `includes/class-bcp-frontend.php`, `templates/portal.php` |
| Admin screen | `includes/class-bcp-admin.php` |
| Portal interface (compiled) | `assets/js/portal-app.js`, `assets/css/portal.css` |
| Coach evaluations: Square intake, private files, outcomes | `includes/class-bcp-coach-eval.php` |
| Starting coaching pathway (levels, renames, requirements, tasks) | `data/coach-pathway.json` |
| Demo data | `data/demo-seed.json` |

**Records:** each record is a JSON document in `wp_bcp_records`, identified by a collection and an id (for example `s_users / u-b1`).

**Sync:**
- Browsers call `GET sync?since=<revision>` every 5 seconds, or every 30 seconds when the tab is hidden, and receive only the records they're allowed to see.
- When what a person may see changes, for example a coach accepting a new boxer, the server sends a complete refresh.
- Changes go through `POST write`, which applies the rules in `class-bcp-access.php`.

**Shortcode:** the shortcode `[boxing_canada_portal]` also works on other pages. It shows the portal in a frame there.

**Interface source:** the portal's interface source is in the separate `boxing-canada-portal-source.zip`, with the build steps.

## 5. Known limits of version 0.2

These are the next items to address before real medical data is entered:

1. **Uploaded files** (documents, posters, medical scans) are stored inside the records, limited to about 2 MB each. Coach evaluation files already use private file storage (see section 6); the others should move there too.
2. **Medical records** rely on the server, HTTPS and the database being secure. They aren't separately encrypted, and record access isn't yet logged in an audit trail.
3. **Some checks are coarse.** The server checks who may change each record, but not yet every field inside it. For example, a boxer could alter the coach section of their own pre-bout form by calling the API directly.
4. **Evaluation payments** happen in the Square store. Refunds for declined requests are done in Square; the portal only records them.
5. **Trackie imports with "Testing only" ticked** don't create sign-in accounts. Imported members sign in after activating with their code.
6. **Email changes:** changing a member's email in Edit account doesn't change their WordPress sign-in email.
7. **Automatic completion** of coaching-end requests after 14 days happens when an administrator opens the portal, not on a server schedule.
8. **Fonts** load from Google Fonts.

Also required before go-live: a privacy review (PIPEDA, Québec Law 25) and an independent security test.

## 6. Coach evaluations (new in 0.2)

### How an evaluation flows

1. **A coach pays in the Square store.** Square emails the order to coach@boxingcanada.org.
2. **The order email reaches the portal.** A forwarding rule sends it to an inbound-email service, which posts it to the portal. The portal reads the coach's name, NCCP #, email, level, Regular or Challenge evaluation, order number and amount.
   - **Matched by NCCP #, then email:** the request appears under **Coach Programs › waiting for an evaluator**, and NSO administrators get a notification.
   - **No match, or the level can't be read:** the order waits under **Square evaluation orders** for an administrator to **Match to member** or **Dismiss**.
   - **Duplicates** (the same order or email twice) are recorded but don't create a second request.
   - **Missing emails:** administrators can paste an order email with **Add an order email**.
3. **Boxing Canada assigns an evaluator.** The evaluator gets a portal notification and an email, and a daily reminder after one day.
4. **The evaluator checks readiness.** The evaluation shows the pathway chart filled in from The Locker (NCCP #) and Trackie (membership).
   - An item confirmed another way (for example a course not yet in The Locker) can be marked as met, with a note.
   - If the boxing course is missing, the evaluator can choose a **Challenge evaluation**.
   - The evaluator then sends the **ready** email, which opens the tasks, or the **outstanding items** email. Both are built from the templates and are editable before sending, in English or French.
5. **Coach and evaluator share one screen.** For each task:
   - The coach adds video links, uploads photos or PDFs of templates (private storage, 20 MB at most), fills in the online forms or writes answers, then submits the task for review.
   - The evaluator assigns videos or skills, gives feedback, and marks the task complete or asks for more work.
   - Both can comment on each task and send messages.
6. **The evaluator records the outcome** and sends the feedback email. A **certified** outcome updates the coach's level in the portal, and the evaluation appears under **Certified: enter in The Locker** until someone marks it entered.

The server checks every change: coaches can change only their own work, evaluators only readiness, assignments, feedback and the outcome, and neither can overwrite the other's work.

### Setting up the Square email intake

1. In **Tools › Boxing Canada Portal › Coach evaluations**, copy the **inbound email address (webhook)**. Keep it private.
2. Create an inbound-email address with a service such as Postmark (Inbound stream), Mailgun (Routes) or SendGrid (Inbound Parse). Set its webhook to the address from step 1.
3. In Microsoft 365, add a rule on coach@boxingcanada.org: messages from Square (squareup.com) whose subject mentions an order **redirect** to the service's inbound address.
   - Microsoft 365 blocks automatic forwarding to outside addresses by default.
   - A Microsoft 365 administrator must allow it for this mailbox, in the outbound spam policy.
4. Place a test order, or paste a real order email with **Add an order email**, then **Check how it reads**.
   - If the name, NCCP # or level comes out wrong, send a sample of the email to whoever maintains the plugin, so the reading rules can be adjusted.
5. Set **Evaluation emails sent from** (for example coach@boxingcanada.org). The SMTP or email-delivery plugin must be allowed to send from that address. Replies go to the evaluator, and **Copy evaluation emails to** receives a copy.

### Changing courses and names (for example the 2027 pathway)

Use **Coach Programs › Coaching pathway › Edit**. For each level you can set:

- **Names & dates:** the code, English and French names, scheduled name changes (Instruction Beginner already becomes Club-Level Coach on January 1, 2027), the date it's offered from, and the other names the portal accepts in Square orders.
- **Readiness requirements:** what the evaluator checks, from The Locker, Trackie or the portal.
- **Evaluation tasks:** instructions, resources, what coaches can submit, and the online forms.

Club Instructor and International-Level Coach are already set up, offered from January 1, 2027. For any other new course, use **Add a level**. Evaluations already under way keep the tasks they started with.

The starting pathway ships in `data/coach-pathway.json`. The Locker match phrases are starting points: check them against a real Locker export, using the "coaches match" count beside each one.

### Hosting notes for evaluations

- **Private files** are stored in `wp-content/uploads/bcp-private/`. They are blocked on Apache by an `.htaccess` file. On nginx, add a `location` rule that denies that folder. Include the folder in backups: the portal's JSON backup contains file records but not the files themselves.
- **Upload size:** the limit is the smaller of 20 MB and PHP's `upload_max_filesize` and `post_max_size`. Set both to at least 20M. Videos should be shared as links.
- **Never store card details.** The portal records only the Square order number and amount.

## 7. Updates from GitHub (new in 0.2.1)

### How sites update

- **Where updates come from:** the plugin checks the GitHub releases of BoxingCanadaAdmin/boxing_canada_portal, not wordpress.org.
- **What sites see:** a new release shows up under **Dashboard › Updates** and **Plugins**, with its release notes under "View details".
- **Settings** are in **Tools › Boxing Canada Portal › Updates**:
  - **Install new releases automatically** is on by default. WordPress checks twice a day and installs in the background, using real cron if the host provides it.
  - **Also install pre-releases** is for the test site only. Pre-releases have tags like `v0.3.0-beta.1`.
  - **Check GitHub now** checks straight away.
- **What an update keeps:** portal data is untouched. Data changes that come with a release (for example a new pathway structure) run on the next page load.
- **Private repository:** the repository is public today. If it becomes private, add this line to `wp-config.php` on each site, with a fine-grained GitHub token that has read-only "Contents" access to the repository:

  ```
  define( 'BCP_GITHUB_TOKEN', 'github_pat_...' );
  ```
- **One-time manual step:** sites running 0.2.0 or earlier don't have the updater yet. Upload the 0.2.1 zip once by hand; every later release then arrives automatically.

### Publishing a release

1. Run `scripts/bump-version.sh 0.3.0` on a branch. Commit it with the changes (including the compiled `plugin/` files from `npm run build`), and merge the pull request.
2. Tag the merge on `main` and push the tag:

   ```
   git tag v0.3.0
   git push origin v0.3.0
   ```

   The **Release** workflow then:
   - checks that the tag matches the plugin version;
   - checks the PHP syntax;
   - rebuilds the interface and confirms it matches what's committed;
   - builds `boxing-canada-portal.zip`;
   - publishes the GitHub release with notes generated from the merged pull requests.
3. **Test first:** to try a release on the test site before the live portal gets it, use a pre-release tag such as `v0.3.0-beta.1`. Only sites with **Also install pre-releases** turned on install it. When it's ready, publish `v0.3.0`.

**Rolling back:** download the previous release's zip from GitHub and upload it under **Plugins › Add New › Upload Plugin**, choosing **Replace current with uploaded**. Turn off automatic updates until the fix is released.
