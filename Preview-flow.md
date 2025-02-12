---
mermaid:
  theme: default
---

graph LR
    %% User Entry Points
    User((User)) --> AnonymousUser[Anonymous User]
    User --> AuthUser[Authenticated User]
    
    subgraph Authentication
        AnonymousUser --> Auth0[Auth0 Login]
        Auth0 --> AuthUser
    end

    subgraph Content Organization
        %% Special Sections
        DestacarPages[Featured\nDestacar] --> Home
        ClosingSoon[Closing Soon\n7 days] --> Home
        
        %% Main Content and Templates
        Home[/Home Page/] --> |database.html| MainView[Main View]
    end

    subgraph Search Types
        MainView --> StructuredSearch[Structured Search]
        MainView --> OpenSearch[Open Search]

        %% Structured Search Path
        StructuredSearch --> |_filters.html| DisciplineFilters[Discipline Filters]
        DisciplineFilters --> |Shows Count| DisciplineGroups[Main Categories]
        DisciplineGroups --> |Shows Count| Subdisciplines[Subcategories]
        
        %% Open Search Path
        OpenSearch --> |_search_bar.html| SearchBar[Search Bar]
        SearchBar --> |Keywords\nLocation\nDates| SearchQuery
        
        %% Results
        DisciplineGroups --> |_search_results.html| FilteredResults[Filtered Results]
        Subdisciplines --> |_search_results.html| FilteredResults
        SearchQuery --> |_search_results.html| FilteredResults
    end

    subgraph User Features
        AuthUser --> |preferences.html| Preferences[/User Preferences/]
        Preferences --> CustomizedView[Personalized Results]
        CustomizedView --> FilteredResults
    end

    subgraph Data Pipeline
        NotionAPI[Notion API] --> |Fetch| DataProcessor[Data Processor]
        DataProcessor --> |Process & Group| RedisCache[Redis Cache]
        RedisCache --> |Serve| ContentGroups[Content Groups]
        
        %% Content Distribution
        ContentGroups --> DestacarPages
        ContentGroups --> ClosingSoon
        ContentGroups --> MainView
    end

    subgraph Admin
        AdminUser((Admin)) --> RefreshCache[/Refresh Cache/]
        RefreshCache --> NotionAPI
    end

    %% Metadata Flows
    RedisCache --> |Update Counts| DisciplineCounts[Discipline Counts]
    DisciplineCounts --> DisciplineFilters

    %% Template Components
    FilteredResults --> |_opportunity_card.html| OpportunityCard[Opportunity Card]
    FilteredResults --> |pagination.html| Pagination[Pagination]

    %% Styling
    classDef userNode fill:#f9f,stroke:#333
    classDef authNode fill:#bbf,stroke:#333
    classDef dataNode fill:#bfb,stroke:#333
    classDef routeNode fill:#fbb,stroke:#333
    classDef adminNode fill:#ffb,stroke:#333
    classDef specialSection fill:#fdb,stroke:#333
    classDef template fill:#dfd,stroke:#333

    class User,AnonymousUser,AuthUser userNode
    class Auth0 authNode
    class NotionAPI,RedisCache,DataProcessor,ContentGroups dataNode
    class Home,Preferences,RefreshCache routeNode
    class AdminUser adminNode
    class DestacarPages,ClosingSoon specialSection
    class OpportunityCard,SearchBar,DisciplineFilters,Pagination template