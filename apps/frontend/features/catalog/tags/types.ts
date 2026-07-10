export interface Tag {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagInput {
  title: string;
  slug?: string; // omit if server-generated from title
  description?: string | null;
}

export interface UpdateTagInput {
  title?: string;
  slug?: string;
  description?: string | null;
}

// Used by AttachProductTags / SyncProductTags / DetachProductTags
export interface ProductTagsInput {
  tagIds: number[];
}

// Matches TagFilter/BaseFilter on the Go side — adjust fields to match
// whatever BaseFilter actually contains (page/limit/sort/search etc.)
export interface TagListParams {
  page?: number;
  limit?: number;
  sort?: string;
}
