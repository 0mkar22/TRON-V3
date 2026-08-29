package models

import (
	"time"
)

type User struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"` // Maps to auth.users in Supabase
	Email     string    `gorm:"type:text;not null" json:"email"`
	FullName  string    `gorm:"type:text" json:"full_name"`
	CreatedAt time.Time `gorm:"default:timezone('utc'::text, now());not null" json:"created_at"`

	OrganizationMembers []OrganizationMember `gorm:"foreignKey:UserID"`
}

func (User) TableName() string {
	return "users"
}

func (u *User) GetPrimaryOrgID() string {
	if len(u.OrganizationMembers) > 0 {
		return u.OrganizationMembers[0].OrgID
	}
	return ""
}

func (u *User) GetPrimaryRole() string {
	if len(u.OrganizationMembers) > 0 {
		return u.OrganizationMembers[0].Role
	}
	return "developer"
}
