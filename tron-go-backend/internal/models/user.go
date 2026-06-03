package models

import (
	"time"
)

type User struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"` // Maps to auth.users in Supabase
	Email     string    `gorm:"type:text;not null" json:"email"`
	FullName  string    `gorm:"type:text" json:"full_name"`
	OrgID     string    `gorm:"type:uuid" json:"org_id"`
	Role      string    `gorm:"type:text;default:'developer'" json:"role"`
	CreatedAt time.Time `gorm:"default:timezone('utc'::text, now());not null" json:"created_at"`

	// Foreign Key relationship
	Organization Organization `gorm:"foreignKey:OrgID"`
}

func (User) TableName() string {
	return "users"
}
