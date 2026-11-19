# CSV-to-LDIF Converter: OUD Bulk Data Upload User Guide

## 1. Purpose and scope

This manual covers the CSV-to-LDIF converter in `csv-to-ldif.html` and `app.js`, as inspected on 19 November 2026. It turns CSV rows into either LDAP entry records or LDIF change records in a browser. It does **not** connect to Oracle Unified Directory (OUD) or execute an import. An operator must review the downloaded file and run the appropriate OUD command. The repository has no README, package manifest, converter configuration file, or conversion CLI.

The repository also contains separate LDIF-to-CSV, LDIF Cleaner, and LDIF Error Fixer pages. They are optional follow-up tools, not stages automatically run by this converter; see [Section 13](#13-related-pages-in-this-repository).

### Implemented operation matrix

| Workflow in the page | Generated records | Use case |
| --- | --- | --- |
| **Create Entries** → **New Users** | Plain entry records (`dn:` and mapped attributes); no `changetype` | Add new users or other entries with OUD `ldapmodify --defaultAdd`, or import entry data through an approved OUD import procedure |
| **Create Entries** → **Old Users** | `changetype: modify` with `replace:` for each populated mapped attribute | Replace values on existing entries |
| **Group Operations** → **Group Membership** | `changetype: modify` with `add:`, `delete:`, or `replace:` on `member` or `uniqueMember` | Change memberships on one group or groups named in CSV |
| **Group Operations** → **Single User Attribute** | One `changetype: modify` per CSV row with `add:`, `delete:`, or `replace:` on a named attribute | Change one attribute on each existing user |

`delete:` above deletes an **attribute value** or an **entire attribute** when no value is supplied. The converter does not generate `changetype: delete` for entries, `modrdn`/`moddn` for renames or moves, or parent/container entries. Dynamic parent DNs choose an existing branch for each generated entry; they do not build a hierarchy in OUD.

## 2. Installation and execution

### Prerequisites

- A modern desktop browser with JavaScript, the File API, and downloads enabled. Clipboard copy additionally depends on the browser's clipboard permission and secure-context rules; **Download LDIF** does not need clipboard access.
- The repository files together in one folder. `csv-to-ldif.html` loads sibling `app.js`, `theme.js`, and `style.css`. No package installation, build, database, or server is required for conversion.
- A prepared CSV file and the target OUD suffix, existing parent entries, schema, bind account, and import procedure. OUD commands run separately on an administrator workstation or OUD host.

From the repository directory on Windows PowerShell, open the converter:

```powershell
Start-Process -FilePath .\csv-to-ldif.html
```

Alternatively, open `csv-to-ldif.html` in a browser's **File → Open** dialog. If local-file restrictions in the chosen browser interfere, a local web server is optional:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000/csv-to-ldif.html`. Python is only needed for this optional serving method. There is **no CSV-to-LDIF CLI command** in this repository; `node app.js` is not an execution path because the script expects the page's DOM.

The conversion code uses the browser's file text reader and creates a local download. It contains no converter-side network request or OUD bind. As with any browser workflow, use an organization-approved browser and deployment location for directory data.

## 3. Input CSV contract

1. Supply a `.csv` file with a **header row first** and at least one nonblank data row. Upload by clicking the CSV zone or dragging a file onto it.
2. Each header used by a mapping must have the **exact case and spelling** shown in the CSV. Avoid blank and duplicate headers. Keep each data row aligned with the header row.
3. The parser supports quoted fields, embedded delimiter characters inside quotes, doubled quotes (`""`), and quoted line breaks. It trims whitespace around every parsed field and ignores fully blank rows. Save as UTF-8 text; the app does not expose an encoding selector.
4. On upload, the app guesses a delimiter from the **first line** by counting commas, semicolons, tabs, and pipes. It selects the highest count, preferring comma on a tie. Inspect the displayed row and column count. The visible **Delimiter** text box is informational only: changing it does **not** reparse the file. For an incorrect guess, correct the source CSV/header and upload it again.
5. The converter does not reject malformed quotes, uneven row lengths, empty/duplicate headers, or duplicate target DNs. Missing cells become empty strings; extra cells are ignored. Validate these in the source data before upload.

There is no universal required column set. Columns are required by the DN template, attribute mappings, or operation settings you choose. The following are working input shapes, with example suffixes that must be replaced for your directory.

**New or existing user entries** (`users.csv`):

```csv
cn,sn,givenName,mail,department
amal.salem,Salem,Amal,amal.salem@example.com,Engineering
faisal.ali,Ali,Faisal,faisal.ali@example.com,Finance
```

Here `cn` is needed by the example DN template `cn={cn},ou=People,dc=example,dc=com`; `sn` and `cn` are needed by the example `person` schema. `givenName`, `mail`, and `department` are optional mappings only if those attributes are allowed by the actual OUD schema. The utility does not know which columns or attributes your schema requires.

**Dynamic parent** (`users-by-ou.csv`):

```csv
cn,sn,parentOU
amal.salem,Salem,Engineering
faisal.ali,Ali,Finance
```

**Group membership** (`memberships.csv`):

```csv
cn,groups
amal.salem,ops;reviewers
faisal.ali,reviewers
```

**Single-user attribute changes** (`titles.csv`):

```csv
cn,title
amal.salem,Senior Analyst
faisal.ali,Directory Analyst
```

## 4. Standard operator workflow

1. Confirm the target suffix, OUD object classes, required attributes, entry naming attribute, existing parents, and whether the target DNs already exist. Prepare a small test CSV first.
2. Open `csv-to-ldif.html`. Choose **Create Entries** or **Group Operations** before uploading.
3. Upload the CSV. In Create Entries mode, the browser asks whether the rows are **old users**: **OK** selects modify; **Cancel** selects new entries. The **LDIF Mode** selector can be changed afterward.
4. Configure the appropriate workflow in Sections 5–9. Replace all example `dc=example,dc=com`, `cn=users`, and `cn=groups` values with the actual OUD tree.
5. Click **Convert to LDIF**. Read the complete preview and the warning banner. Only the first five warnings are shown; a count indicates additional warnings. Resolve any skipped rows or bad records in the CSV/configuration and convert again.
6. Click **Download LDIF** to save `output.ldif`, or use the preview's copy button if browser clipboard access works. Copy does not create a file. The downloaded file is overwritten or browser-renamed on a later download depending on browser settings.
7. Inspect the saved file as UTF-8 text, verify record count and representative DNs/attributes against the source, and follow [Section 11](#11-use-the-output-in-oud). **Convert** is a preview/generation step; it makes no directory change.

**Reset** clears uploaded files, mappings, operations, preview, and current mode-specific settings. After Reset, explicitly set a clean DN template: the Reset handler sets `dn: cn={cn},ou=People,dc=example,dc=com`, including a leading `dn: `, whereas the generator itself prepends `dn: `. Using that reset value unchanged produces `dn: dn: ...`.

### Configuration reference

| Control | Initial value / accepted setting | Effect |
| --- | --- | --- |
| Mode | Create Entries | Selects entry creation/replacement mapping or group/user change cards. |
| Delimiter | `,` before upload; guessed on upload | Displays the guessed CSV delimiter. Manual edits do not affect parsing. |
| LDIF Mode | New Users; upload prompt can change it | Plain new entries or existing-entry `replace:` changes. |
| DN Template | `cn={cn},cn=users,dc=maliyah,dc=gov` on initial page load | Entry DN; `{targetAttribute}` tokens resolve from mapped target names. Replace this example with the real OUD DN. |
| Dynamic parent DN | Off; parent format `ou={value}` | Builds a parent fragment from a selected CSV column and inserts it at `{parent}` or after the first RDN. |
| Mapping parts | None | Ordered CSV columns and literal text for one target attribute. No automatic same-name mapping. |
| Mapping separator / options | Space; trim on; skip empty on; custom separator off (`,` when enabled) | Controls how parts become one target value. |
| Attribute Type | Text | DN uses an attribute DN template containing `{value}`. |
| Repeatable attributes | `objectClass`, `replace` | Splits mapped values into separate attribute lines; configurable per session. |
| Group operation | Add Members; `member`; static group DN | Add, delete, or replace `member`/`uniqueMember` values using a static or CSV-derived group DN. |
| Member DN template | `cn={value},cn=users,dc=example,dc=com` | Turns each selected member cell into a DN. |
| Dynamic group delimiter | `;` | Splits a group column into multiple groups for each CSV row. |
| Single-user operation | Add Value; `mail` | Add, delete, or replace one named attribute per row at the configured user DN. |

The initial DN and operation templates are examples, not schema defaults. Configuration lives only in the open page; upload and sample-LDIF parsing do not save a reusable profile.

## 5. Create new entries

1. Choose **Create Entries**, upload `users.csv`, and select **New Users** in **LDIF Mode** (or click **Cancel** in the upload prompt).
2. Set **DN Template** to a DN only, for example `cn={cn},ou=People,dc=example,dc=com`. Do not include `dn:`. The `{cn}` token is resolved from a **mapped target attribute named `cn`**, not directly from an unmapped CSV header.
3. Add target attributes with **+ Add Custom** or upload/paste an optional sample LDIF and click **Parse LDIF**. Click a target attribute, then click one or more CSV columns to map them. For the sample, map `cn ← cn`, `sn ← sn`, `givenName ← givenName`, and `mail ← mail`. A second click on a selected CSV column removes it from that mapping.
4. Add `objectClass` with **+ Add Custom**. Select it, type `top person organizationalPerson inetOrgPerson` into **Literal Value**, and click **Add Literal**. `objectClass` is a repeatable target by default; the generator splits its mapped text on whitespace, commas, or semicolons and writes separate, deduplicated `objectClass:` lines. Check required object classes against OUD schema. Sample LDIF attribute inference excludes `objectClass`, so it must be added explicitly.
5. Convert and inspect every record. For the first row, the intended shape is:

   ```ldif
   dn: cn=amal.salem,ou=People,dc=example,dc=com
   objectClass: top
   objectClass: person
   objectClass: organizationalPerson
   objectClass: inetOrgPerson
   cn: amal.salem
   sn: Salem
   givenname: Amal
   mail: amal.salem@example.com
   ```

   Custom attribute names are normalized to lowercase by the **+ Add Custom** dialog; LDAP attribute names are case-insensitive. The generated new-entry record has no `changetype: add`.

### Optional target-attribute discovery and mapping controls

- **Sample LDIF:** Upload `.ldif`/`.txt` or paste text and click **Parse LDIF**. The app scans lines for attribute names only; it does not infer object classes, schemas, DN patterns, values, or mappings. It excludes `dn` and `objectClass`; if the sample is a change file, control words such as `changetype` or `replace` can appear as target choices, so do not map them as user attributes. **Clear** empties the paste box but does not clear already discovered attributes.
- **Multiple source parts:** For a selected target attribute, click several CSV columns and/or add literals. Parts are joined in selection order. The default separator is one space; **Trim result** and **Skip empty values** start enabled. Use **Separator**, or check **Use custom separator** and enter its delimiter (which takes precedence over Separator). This makes **one output value**, except for configured repeatable attributes.
- **DN-valued attribute:** Set **Attribute Type → DN** for a selected target, such as `manager`; enter an **Attribute DN Template** such as `cn={value},ou=People,dc=example,dc=com`, and map the source column containing the manager's CN. The template substitutes the combined mapping value. The prefilled template is only a guess from the main DN template; check it.
- **Repeatable attributes:** The default set is `objectClass` and `replace`. Add a preset or custom target name, or remove a chip. For these targets only, the generator splits the combined mapped value on **any whitespace, comma, or semicolon**, trims parts, removes duplicates, and emits one line per part. It does not preserve multiword values in repeatable attributes. `replace` is an LDIF control word, not a sensible user attribute mapping; leave it unmapped. Removing all chips still causes the generator to fall back to its default set.
- **Clear Mapping:** Removes all selected inputs for the current target attribute. No configuration is persisted or exported between sessions.

## 6. Modify existing entries in Create Entries mode

1. Choose **Create Entries** and upload an existing-user CSV. Click **OK** in the upload prompt, or select **Old Users (Modify Existing)** in **LDIF Mode**.
2. Set the exact DN template for the existing entries, for example `cn={cn},ou=People,dc=example,dc=com`. Map `cn ← cn` so the token resolves. Map only attributes intended for replacement, for example `mail ← mail` or `title ← title`. A mapped `cn` is also emitted as a `replace: cn` operation; review it for your naming policy.
3. Convert. Each populated mapped attribute becomes its own `replace:` block. A row with `mail` mapped produces:

   ```ldif
   dn: cn=amal.salem,ou=People,dc=example,dc=com
   changetype: modify
   replace: cn
   cn: amal.salem
   -
   replace: mail
   mail: amal.salem@example.com
   -
   ```

4. Confirm the DN already exists and that replacing each listed attribute is intended. An empty CSV value is **omitted**, not converted to an attribute deletion. Avoid mapping `objectClass` unless intentionally replacing the entry's complete object class value set.

The mode does not implement add/delete attribute changes; use Group Operations → Single User Attribute for those. It can emit a `changetype: modify` record with **no operations** when all mappings are empty; such output needs correction before OUD submission.

## 7. Dynamic parent DNs and hierarchy placement

1. In **Create Entries**, upload `users-by-ou.csv` and set the main DN template, for example `cn={cn},dc=example,dc=com`.
2. Check **Dynamic parent DN from CSV**. Choose **Parent Column** `parentOU` and set **Parent Format** to `ou={value}`.
3. Map `cn`, `sn`, and the required object classes as in Section 5. The first example DN becomes `cn=amal.salem,ou=Engineering,dc=example,dc=com`.
4. Inspect the first-row DN preview, convert, and check every generated DN. If the CSV parent cell already contains `=` (for example `ou=Engineering,ou=EMEA`), the app uses it as a DN fragment instead of applying Parent Format. An empty parent cell skips that row with a warning.

Without `{parent}` in the main DN template, the parent fragment is inserted immediately after the first unescaped RDN. To control placement, put `{parent}` in the template, for example `cn={cn},{parent},dc=example,dc=com`. Parent entries such as `ou=Engineering,dc=example,dc=com` must already exist in OUD. This feature does not create those entries or sort records by hierarchy.

## 8. Group membership operations

1. Choose **Group Operations** and upload `memberships.csv`. Click **+ Add Operation**; the button requires a CSV with headers.
2. Leave **Operation Target → Group Membership**. Choose **Operation**: **Add Members** (`add:`), **Delete Members** (`delete:`), or **Replace Members** (`replace:`). Select `member` or `uniqueMember` to match the target group's object class and schema. Choose **Member Column** `cn` and **Member DN Template** `cn={value},ou=People,dc=example,dc=com`.
3. For one group, leave **Use Group Names from CSV?** off and enter its full **Group DN**, for example `cn=reviewers,ou=Groups,dc=example,dc=com`. The app gathers all nonempty CSV member values into one modify record for that group.
4. For several groups, check **Use Group Names from CSV?**, select **Group Column** `groups`, set **Group Delimiter** to `;`, and set **Group DN Template** to `cn={value},ou=Groups,dc=example,dc=com`. A row containing `ops;reviewers` contributes the member to both groups. If the CSV already contains complete group DNs, leave Group DN Template empty. The app groups all rows by generated group DN and writes one modify record per group.
5. Add other operation cards if needed, convert, inspect, and download. Example dynamic-group output for the `ops` group is:

   ```ldif
   dn: cn=ops,ou=Groups,dc=example,dc=com
   changetype: modify
   add: member
   member: cn=amal.salem,ou=People,dc=example,dc=com
   ```

**Replace Members** replaces the full membership attribute with exactly the collected values for that group, potentially removing members not present in the CSV. **Delete Members** removes the listed values; a blank member cell is skipped. The app does not deduplicate members or verify referenced user/group DNs. Multiple operation cards can generate multiple records for the same DN; review their order and effect.

## 9. Single-user attribute operations

1. Choose **Group Operations**, upload `titles.csv`, and click **+ Add Operation**.
2. Change **Operation Target** to **Single User Attribute**. Set **CN Column** `cn`, **Value Column** `title`, **Target Attribute** `title`, and **User DN Template** `cn={cn},ou=People,dc=example,dc=com`.
3. Choose **Add Value**, **Delete Value**, or **Replace Value**. Convert and inspect. For **Replace Value**, a sample record is:

   ```ldif
   dn: cn=amal.salem,ou=People,dc=example,dc=com
   changetype: modify
   replace: title
   title: Senior Analyst
   ```

4. Download and submit as a change file. For **Delete Value**, a populated value deletes that specific attribute value; an empty value emits `delete: title` with no value line and requests deletion of the entire attribute. Empty values for **Add Value** and **Replace Value** skip the row with a warning. Missing CN values also skip the row.

Only `{cn}` and `{value}` are substituted in the user DN template, both from the selected CN column. Target attribute text is used as entered; the app does not validate it against LDAP schema. Changing a field in an operation card commits on the field's `change` event and redraws the card; finish editing or leave the field before converting.

## 10. Validation, errors, and troubleshooting

| Symptom | Cause in the current implementation | Operator action |
| --- | --- | --- |
| Incorrect row/column count or shifted fields | Delimiter guessed from first line by raw character count; malformed or uneven CSV is not rejected | Fix/export the CSV with a clear header and delimiter, then upload again. Editing **Delimiter** after upload has no effect. |
| `DN template not fully resolved` and row skipped | A `{targetAttribute}` token has no mapping, or a mapped value is empty | Map the named target attribute to a populated CSV column, or correct the DN template. Placeholder names are case-sensitive in the main DN template. |
| `Empty parent value ... entry skipped` | Dynamic parent column is blank for that row | Populate the parent column or disable dynamic parent mode. |
| `Duplicate attribute ... skipped` | Two mappings resolve to the same nonrepeatable target name, case-insensitively | Keep one target mapping; combine source columns within it if needed. |
| `No output generated` | No usable rows/operations, or all rows were skipped | Inspect CSV row count, required columns, operation settings, and warnings. |
| No `objectClass` lines in new entries | Sample LDIF parsing deliberately excludes `objectClass`; it is not auto-added | Add and map/literal `objectClass` explicitly. |
| `dn: dn: ...` | Reset inserted `dn: ` into the DN Template field | Delete the leading `dn: ` before conversion. |
| OUD reports `No Such Object` | Parent DN or referenced target entry is absent, or DN template is wrong | Create/verify parent containers first; check the full DN and suffix. |
| OUD reports `Object Class Violation`, invalid syntax, or duplicate entry/value | No schema, uniqueness, or existence check is performed by this page | Correct object classes, required attributes, values, or target operation after reading OUD's exact error. |

The page displays warnings but does **not** block download when some rows are skipped. It shows at most five warning messages, so reconcile the source row count with the output record count. A successful preview is not an LDIF validator or OUD acceptance test.

**LDIF encoding/escaping limits:** the generator does not perform complete RFC LDIF encoding, line folding, DN/RDN escaping, or schema-specific value checks. Its `escapeLdif` routine doubles backslashes and converts newlines to literal `\n`. For leading whitespace or `#`, it constructs a base64-looking fragment that is not emitted with standard `attribute:: base64` syntax. Avoid such values, multiline/binary values, and unescaped DN special characters unless an administrator repairs and validates the output. A comma, plus, quote, backslash, leading/trailing space, or similar special character in a DN component needs deliberate LDAP DN escaping; the page does not do this.

## 11. Use the output in OUD

The commands below are **OUD commands**, not repository commands. Replace host, port, bind DN, password-file path, file path, and suffix with approved values. Use OUD's TLS connection options for your environment. The examples assume the OUD tools are on `PATH` and that the chosen bind account has rights to perform the changes. Store `output.ldif` as UTF-8 and review it before execution. [Oracle's OUD administration guide](https://docs.oracle.com/en/middleware/idm/unified-directory/14.1.2/oudag/managing-directory-data.html) documents `ldapmodify` for adds and changes; the [CLI reference](https://docs.oracle.com/en/middleware/idm/unified-directory/14.1.2/oudag/oracle-unified-directory-command-line-interface-reference.html) documents the command options.

**New-entry output:** Because the converter writes plain entries without `changetype: add`, use `--defaultAdd` with `ldapmodify`:

```sh
ldapmodify --hostname oud.example.com --port 1389 \
  --bindDN 'cn=Directory Manager' --bindPasswordFile /secure/oud-bind.pwd \
  --defaultAdd --filename /staging/output.ldif
```

**Modify, group membership, or single-user change output:** These records contain `changetype: modify`, so omit `--defaultAdd`:

```sh
ldapmodify --hostname oud.example.com --port 1389 \
  --bindDN 'cn=Directory Manager' --bindPasswordFile /secure/oud-bind.pwd \
  --filename /staging/output.ldif
```

For a large **new-entry** load, OUD also provides `import-ldif`. Its mode and impact differ from `ldapmodify`: offline import requires the server stopped, and the default/append/replace behavior must be chosen for the target back end. An example **append** command for an already existing back end is:

```sh
stop-ds
import-ldif --backendID userRoot --includeBranch 'dc=example,dc=com' \
  --append --ldifFile /staging/output.ldif
start-ds
```

Run this only under the OUD bulk-load runbook, after confirming back-end ID, suffix, backups, replication plan, and service window. Do **not** pass the converter's `changetype: modify` change records to `import-ldif` as if they were entry data. OUD documents [offline import, append behavior, and UTF-8 input](https://docs.oracle.com/en/middleware/idm/unified-directory/14.1.2/oudag/managing-directory-data.html); [replicated topology guidance](https://docs.oracle.com/en/middleware/idm/unified-directory/14.1.2/oudag/replicating-directory-data.html) notes that `import-ldif` data does not automatically replicate.

For the SOP, record the source CSV, target suffix, template/settings, output filename, expected vs. generated record count, OUD command and server, command result, and any rejects. Verify representative entries and memberships with the organization's approved OUD query process after the load. Do not treat the browser preview or the downloaded file as proof of a successful directory update.

## 12. Missing, incomplete, or unsupported functionality

- No CLI, batch runner, conversion API, saved configuration, schema discovery, OUD connection, direct upload, import status, or server-side validation.
- No whole-entry deletion, rename/move (`modrdn`/`moddn`), parent/container creation, hierarchy ordering, or automatic dependency handling.
- No user-defined CSV reparse through the displayed **Delimiter** field; first-line auto-detection can be wrong.
- No robust CSV structural validation, full LDIF encoding/escaping, duplicate-DN detection, or assurance that output conforms to OUD schema.
- No support for clearing attributes through Create Entries → Old Users when a CSV field is empty; use Single User Attribute → Delete Value with an empty value cell, after verifying that deleting the entire attribute is intended.
- No complete warning export; only the first five warnings appear in the page. There is no dry run against OUD.

## 13. Related pages in this repository

- `ldif-to-csv.html` / `ldif-to-csv.js`: a separate LDIF-to-CSV exporter with attribute selection, multi-value separator, and split rules. It does not run during CSV-to-LDIF conversion.
- `ldif-cleaner.html` / `ldif-cleaner.js`: a separate tool that applies configured attribute fixes to LDIF entries and compares an extract with a master LDIF by normalized DN to remove matches from the master output.
- `ldif-error-fixer.html` / `ldif-error-fixer.js`: a separate tool that matches compact error lines of the form `[code] DN -> message` to LDIF blocks and attempts limited fixes; unresolved errors remain for manual review.

These companion pages are not OUD validators. Review any output from them before use in OUD, especially if the source contains change records, encoded values, or non-ASCII text.
