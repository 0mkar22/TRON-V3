package models

type OrganizationMember struct {
	OrgID  string `gorm:"type:uuid;primaryKey" json:"org_id"`
	UserID string `gorm:"type:uuid;primaryKey" json:"user_id"`
	Role   string `gorm:"type:text;not null" json:"role"`

	Organization Organization `gorm:"foreignKey:OrgID"`
	User         User         `gorm:"foreignKey:UserID"`
}

func (OrganizationMember) TableName() string {
	return "organization_members"
}
