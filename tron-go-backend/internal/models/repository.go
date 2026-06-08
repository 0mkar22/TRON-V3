package models

import (
	"time"

	"gorm.io/datatypes"
)

type Repository struct {
	ID                  string         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrgID               string         `gorm:"type:uuid;uniqueIndex:repo_provider_unique" json:"org_id"`
	RepoName            string         `gorm:"type:text;not null;uniqueIndex:repo_provider_unique" json:"repo_name"`
	PMProvider          string         `gorm:"type:text;not null;column:pm_provider;uniqueIndex:repo_provider_unique" json:"pm_provider"`
	PMProjectID         string         `gorm:"type:text;column:pm_project_id" json:"pm_project_id"`
	Mapping             datatypes.JSON `gorm:"type:jsonb;default:'{}'::jsonb" json:"mapping"`
	CommunicationConfig datatypes.JSON `gorm:"type:jsonb;default:'{}'::jsonb" json:"communication_config"`
	CreatedAt           time.Time      `gorm:"default:now()" json:"created_at"`
	Organization        Organization   `gorm:"foreignKey:OrgID"`
}

func (Repository) TableName() string {
	return "repositories"
}
