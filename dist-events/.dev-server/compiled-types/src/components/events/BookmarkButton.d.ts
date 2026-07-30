interface BookmarkButtonProps {
    isSaved: boolean;
    isPending: boolean;
    onClick: () => void;
}
export declare function BookmarkButton({ isSaved, isPending, onClick }: BookmarkButtonProps): import("react").JSX.Element;
export {};
