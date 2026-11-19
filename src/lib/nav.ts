export const tools = [
	{
		href: '/',
		label: 'Overview',
		icon: 'Home',
		group: null as string | null
	},
	{
		href: '/csv-to-ldif',
		label: 'CSV to LDIF',
		icon: 'DocumentArrowRight',
		group: 'Directory tools'
	},
	{
		href: '/ldif-to-csv',
		label: 'LDIF to CSV',
		icon: 'Table',
		group: 'Directory tools'
	},
	{
		href: '/ldif-cleaner',
		label: 'LDIF cleaner',
		icon: 'Broom',
		group: 'Directory tools'
	},
	{
		href: '/ldif-error-fixer',
		label: 'Error fixer',
		icon: 'ShieldCheckmark',
		group: 'Directory tools'
	}
] as const;

export const breadcrumbs: Record<string, string> = {
	'/': 'Overview',
	'/csv-to-ldif': 'CSV to LDIF',
	'/ldif-to-csv': 'LDIF to CSV',
	'/ldif-cleaner': 'LDIF cleaner',
	'/ldif-error-fixer': 'Error fixer'
};

export const infoContent = {
	help: {
		title: 'Using LDIF Builder',
		html: `<p>Choose a tool from the navigation. Files are processed in this browser; applying changes to a directory is a separate step.</p>
        <h3>CSV to LDIF</h3><p>Choose a CSV file, select whether to create or modify entries, map the columns to LDIF attributes, and review the output.</p>
        <h3>LDIF to CSV</h3><p>Choose a file or paste LDIF content, select attributes, and convert. Optional split rules turn combined values into separate columns.</p>
        <h3>LDIF cleaner</h3><p>Update attributes, or compare a master file with an extract and remove matching entries from the master.</p>
        <h3>Error fixer</h3><p>Choose the submitted LDIF and paste the LDAP error output. Review the proposed fixes and any unresolved errors before downloading.</p>
        <p><a href="/USER_GUIDE.md" download>Download the full user guide</a></p>`
	},
	privacy: {
		title: 'How your files are handled',
		html: `<p>File contents are read and processed in your browser. These tools do not upload your file contents or connect to your directory.</p>
        <p>Downloads are saved to the location chosen by your browser. Closing or reloading the page clears the current workspace; the app does not save your progress.</p>
        <p>Only your appearance and navigation preferences are stored on this device. Your uploaded files, pasted content, mappings, and results are not saved by the app.</p>
        <p>Use your organisation's approved browser and storage location when working with directory data.</p>`
	},
	security: {
		title: 'Before applying directory changes',
		html: `<p>LDIF Builder prepares files. It does not authenticate to LDAP, execute imports, or verify your directory's schema.</p>
        <ul><li>Review generated DNs, attributes, and change operations.</li><li>Keep an original copy of your source files.</li><li>Test the output through your organisation's directory change process before importing it.</li></ul>
        <p>For supported behavior and known limitations, <a href="/USER_GUIDE.md" download>download the user guide</a>.</p>`
	}
} as const;
