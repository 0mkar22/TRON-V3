package models

type Ticket struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	State       string `json:"state"`
}
