package models

import (
	"time"
)

// ProjectAssignment links a specific Developer to a specific Repository/Workflow
type ProjectAssignment struct {
	ID           string    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrgID        string    `gorm:"type:uuid;not null;index:idx_user_repo,unique" json:"org_id"`
	UserID       string    `gorm:"type:uuid;not null;index:idx_user_repo,unique" json:"user_id"`       // The Developer
	RepositoryID string    `gorm:"type:uuid;not null;index:idx_user_repo,unique" json:"repository_id"` // The Mapped Project (Repo)
	AssignedBy   string    `gorm:"type:uuid" json:"assigned_by"`                                       // The Admin who granted access
	CreatedAt    time.Time `gorm:"default:now()" json:"created_at"`

	// Foreign Keys so GORM can easily pull Developer and Repo details
	User       User       `gorm:"foreignKey:UserID"`
	Repository Repository `gorm:"foreignKey:RepositoryID"`
}

func (ProjectAssignment) TableName() string {
	return "project_assignments"
}
