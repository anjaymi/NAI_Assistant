export interface TagData {
    label: string;
    value: string;
    count: number;
    type: string;
}

export interface TagCategoryTag {
    label: string;
    value: string;
    cn: string;
}

export type TagCategoryData = Record<string, TagCategoryTag[]>;
