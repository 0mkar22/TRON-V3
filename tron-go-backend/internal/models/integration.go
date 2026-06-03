package models

import (
	"time"

	"gorm.io/datatypes"
)

// Organization maps to public.organizations
type Organization struct {
	ID        string    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string    `gorm:"type:text;not null" json:"name"`
	CreatedAt time.Time `gorm:"default:now()" json:"created_at"`
}

// Integration maps to public.integrations
type Integration struct {
	ID        string         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrgID     string         `gorm:"type:uuid;not null" json:"org_id"`
	Provider  string         `gorm:"type:text;not null" json:"provider"`
	Token     string         `gorm:"type:text" json:"token"` // 🌟 FIX: Added the missing Token column
	Config    datatypes.JSON `gorm:"type:jsonb;default:'{}'::jsonb;not null" json:"config"`
	SecretID  *string        `gorm:"type:uuid" json:"secret_id"` // Pointer because it can be null
	CreatedAt time.Time      `gorm:"default:timezone('utc'::text, now());not null" json:"created_at"`

	// Establish the Foreign Key relationship
	Organization Organization `gorm:"foreignKey:OrgID"`
}

func (Integration) TableName() string {
	return "integrations"
}

func (Organization) TableName() string {
	return "organizations"
}
