export interface Tag {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: Tag[];
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

export interface MultiSelectContextValue {
  options: Tag[];
  selected: Tag[];
  availableOptions: Tag[];
  addTag: (tag: Tag) => void;
  removeTag: (tag: Tag) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  emptyText: string;
}
