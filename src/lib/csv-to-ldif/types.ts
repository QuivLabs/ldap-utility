export type SourcePart = { type: 'csv' | 'literal'; value: string };

export type Mapping = {
	sourceParts: SourcePart[];
	separator: string;
	trim: boolean;
	skipEmptyParts: boolean;
	attrType: 'text' | 'dn';
	dnTemplate: string;
	useCustomSeparator: boolean;
	customSeparator: string;
	sourceFields?: string[];
};

export type DynamicDnConfig = {
	enabled: boolean;
	column: string;
	template: string;
};

export type BuildRequest = {
	dnTemplate: string;
	dynamicDn?: DynamicDnConfig;
	mappings: Array<Mapping & { targetAttribute: string }>;
	repeatableAttributes: string[];
	entryMode: 'new' | 'modify';
};

export type GroupOperation = {
	id: number;
	targetType: 'group' | 'user';
	groupDn: string;
	operation: 'add' | 'delete' | 'replace';
	memberAttr: string;
	csvColumn: string;
	memberDnTemplate: string;
	useGroupColumn: boolean;
	groupColumn: string;
	groupDnTemplate: string;
	groupDelimiter: string;
	userCnColumn: string;
	userValueColumn: string;
	userAttrName: string;
	userDnTemplate: string;
};

export type BuildResult = { ldif: string; warnings: string[] };
