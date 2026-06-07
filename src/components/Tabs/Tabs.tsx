import "./Tabs.css";

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={`win95-tabs${className ? ` ${className}` : ""}`}>
      <div className="win95-tabs__strip">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`win95-tabs__tab${activeTab === tab.id ? " win95-tabs__tab--active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
