package models

import (
	"time"

	"gorm.io/datatypes"
)

type Workflow struct {
	ID                  string         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrgID               string         `gorm:"type:uuid;not null" json:"org_id"`
	RepoName            string         `gorm:"type:text;not null" json:"repo_name"`
	PMProvider          string         `gorm:"type:text;not null;default:'basecamp';column:pm_provider" json:"pm_provider"`
	PMProjectID         string         `gorm:"type:text;column:pm_project_id" json:"pm_project_id"`
	PMMapping           datatypes.JSON `gorm:"type:jsonb;default:'{}'::jsonb;not null;column:pm_mapping" json:"pm_mapping"`
	CommunicationConfig datatypes.JSON `gorm:"type:jsonb;default:'{}'::jsonb;not null" json:"communication_config"`
	CreatedAt           time.Time      `gorm:"default:timezone('utc'::text, now());not null" json:"created_at"`

	// Foreign Key relationship
	Organization Organization `gorm:"foreignKey:OrgID"`
}

func (Workflow) TableName() string {
	return "workflows"
}
