interface PullToRefreshProps {
    onRefresh: () => Promise<void> | void;
    isRefreshing: boolean;
    children: React.ReactNode;
}
export declare function PullToRefresh({ onRefresh, isRefreshing, children }: PullToRefreshProps): import("react").JSX.Element;
export {};
