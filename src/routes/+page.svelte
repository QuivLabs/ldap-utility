<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
</script>

<svelte:head>
	<title>LDIF Builder | Directory data tools</title>
</svelte:head>

<div class="overview-content">
	<section class="overview-hero" aria-labelledby="overview-title">
		<div>
			<h1 id="overview-title">Directory data,<br />ready for the next step.</h1>
			<p class="hero-description">
				Prepare, convert, and clean your LDAP data in one workspace. Review the output before it reaches your
				directory.
			</p>
			<div class="hero-actions">
				<a class="btn btn-primary" href="/csv-to-ldif">Convert CSV to LDIF</a>
				<a class="text-link" href="#tools">Explore the tools</a>
			</div>
			<p class="hero-note">
				<Icon name="LockClosed" size={16} />
				No account required. File contents stay in your browser.
			</p>
		</div>
		<div class="sample-preview" aria-label="Sample CSV to LDIF conversion">
			<div class="sample-preview-header">
				<strong>CSV to LDIF</strong>
				<span class="sample-label">Sample data</span>
			</div>
			<div class="sample-source">
				<Icon name="Document" size={16} />directory.csv<span>3 mapped columns</span>
			</div>
			<div class="sample-mappings">
				{#each [['Username', 'cn'], ['Last name', 'sn'], ['Email address', 'mail']] as [from, to]}
					<div class="sample-mapping">
						<span>{from}</span>
						<Icon name="Checkmark" size={16} />
						<span>{to}</span>
					</div>
				{/each}
			</div>
			<div class="sample-output">
				<span>output.ldif</span>
				<pre>dn: cn=amal.salem,ou=People,dc=example,dc=com
objectClass: inetOrgPerson
cn: amal.salem
sn: Salem
mail: amal.salem@example.com</pre>
			</div>
		</div>
	</section>

	<div class="overview-divider" aria-label="Processing details">
		<span><Icon name="Document" size={16} />CSV and LDIF files</span>
		<span><Icon name="Checkmark" size={16} />Preview before download</span>
		<span><Icon name="LockClosed" size={16} />No directory connection</span>
	</div>

	<section class="overview-section" id="tools" aria-labelledby="tools-title">
		<div class="section-heading">
			<div>
				<h2 id="tools-title">A tool for each step.</h2>
				<p>Choose what your data needs. Each tool works independently.</p>
			</div>
			<span class="sample-label">4 directory tools</span>
		</div>
		<div class="tool-list">
			<a class="tool-row" href="/csv-to-ldif">
				<span class="tool-row-icon"><Icon name="DocumentArrowRight" size={24} /></span>
				<div>
					<h3>CSV to LDIF</h3>
					<p>Create entries, update attributes, or prepare group membership changes.</p>
				</div>
				<span class="tool-action">Convert CSV</span>
			</a>
			<a class="tool-row" href="/ldif-to-csv">
				<span class="tool-row-icon"><Icon name="Table" size={24} /></span>
				<div>
					<h3>LDIF to CSV</h3>
					<p>Choose directory attributes and export them as spreadsheet columns.</p>
				</div>
				<span class="tool-action">Export CSV</span>
			</a>
			<a class="tool-row" href="/ldif-cleaner">
				<span class="tool-row-icon"><Icon name="Broom" size={24} /></span>
				<div>
					<h3>LDIF cleaner</h3>
					<p>Update attribute values or remove entries found in a comparison file.</p>
				</div>
				<span class="tool-action">Clean LDIF</span>
			</a>
			<a class="tool-row" href="/ldif-error-fixer">
				<span class="tool-row-icon"><Icon name="ShieldCheckmark" size={24} /></span>
				<div>
					<h3>Error fixer</h3>
					<p>Match LDAP error output to source entries and review proposed fixes.</p>
				</div>
				<span class="tool-action">Review errors</span>
			</a>
		</div>
	</section>

	<section class="workflow-section" aria-labelledby="workflow-title">
		<div>
			<h2 id="workflow-title">Review first. Then import.</h2>
			<ol class="workflow-list">
				<li>
					<span class="step-badge">1</span>
					<div>
						<strong>Choose your source</strong>
						<p>Open a CSV or LDIF file, or paste LDIF content into a converter.</p>
					</div>
				</li>
				<li>
					<span class="step-badge">2</span>
					<div>
						<strong>Configure and inspect</strong>
						<p>Map attributes, choose operations, and review the generated output.</p>
					</div>
				</li>
				<li>
					<span class="step-badge">3</span>
					<div>
						<strong>Download your result</strong>
						<p>Save the file and use your directory's import process when ready.</p>
					</div>
				</li>
			</ol>
		</div>
		<aside class="data-boundary">
			<h2>Your directory stays in your control.</h2>
			<p>
				These tools process file contents in your browser. They do not connect to an LDAP server or run an
				import.
			</p>
			<p>Check the output against your directory's schema and import requirements before applying changes.</p>
			<a class="text-link" href="/USER_GUIDE.md" download>
				<Icon name="BookOpen" size={16} />
				Download the user guide
			</a>
		</aside>
	</section>
</div>

<footer class="page-footer">
	<span>LDIF Builder <span aria-hidden="true">/</span> Directory data tools</span>
	<div class="footer-links">
		<a href="/USER_GUIDE.md" download>User guide</a>
		<button type="button" data-info="privacy">Privacy</button>
		<button type="button" data-info="security">Security</button>
	</div>
</footer>
