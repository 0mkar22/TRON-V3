package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/tron-v3.1/tron-go-backend/internal/adapters"
	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
	"github.com/tron-v3.1/tron-go-backend/pkg/redis"
	"github.com/tron-v3.1/tron-go-backend/pkg/vault"
)

type VSCodeService struct{}

func NewVSCodeService() *VSCodeService {
	return &VSCodeService{}
}

func (s *VSCodeService) GetUserFromToken(token string) (models.User, error) {
	var dbUser models.User
	if token == "" {
		return dbUser, fmt.Errorf("missing or invalid token")
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_ANON_KEY")

	req, _ := http.NewRequest("GET", supabaseURL+"/auth/v1/user", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("apikey", supabaseKey)

	client := &http.Client{Timeout: 5 * time.Second}
	res, err := client.Do(req)
	if err != nil || res.StatusCode != http.StatusOK {
		return dbUser, fmt.Errorf("invalid session")
	}
	defer res.Body.Close()

	var authUser struct {
		ID string `json:"id"`
	}
	json.NewDecoder(res.Body).Decode(&authUser)

	if err := database.DB.Where("id = ?", authUser.ID).First(&dbUser).Error; err != nil {
		return dbUser, fmt.Errorf("user not found in database")
	}

	return dbUser, nil
}

func (s *VSCodeService) getRepoAndOrchestrator(repoName string, dbUser models.User) (models.Repository, map[string]interface{}, *PMOrchestrator, error) {
	var repo models.Repository

	fmt.Printf("🔍 [DB TRAP] Searching for Repo: '%s' | OrgID: '%s'\n", repoName, dbUser.OrgID)

	if err := database.DB.Where("repo_name = ? AND org_id = ?", repoName, dbUser.OrgID).First(&repo).Error; err != nil {
		fmt.Printf("⚠️ [DB] Repository '%s' is not mapped in the database.\n", repoName)
		return repo, nil, nil, fmt.Errorf("REPO_NOT_MAPPED")
	}

	if dbUser.Role != "admin" {
		var assignment models.ProjectAssignment
		err := database.DB.Where("user_id = ? AND repository_id = ?", dbUser.ID, repo.ID).First(&assignment).Error
		if err != nil {
			fmt.Printf("❌ [DB FATAL] Developer is not assigned to this repository!\n")
			return repo, nil, nil, fmt.Errorf("RBAC_BLOCKED")
		}
	}

	fmt.Printf("✅ [DB SUCCESS] Found mapping! Provider: %s | Project Key: %s\n", repo.PMProvider, repo.PMProjectID)

	var mapping map[string]interface{}
	json.Unmarshal([]byte(repo.Mapping), &mapping)

	var orch *PMOrchestrator

	if repo.PMProvider == "basecamp" {
		fmt.Println("⛺ [ADAPTER TRAP] Booting Basecamp Orchestrator...")
		orch = NewPMOrchestrator(adapters.NewBasecampAdapter())
	} else if repo.PMProvider == "jira" {
		fmt.Println("📊 [ADAPTER TRAP] Booting Jira Logic...")
		var integration models.Integration
		if err := database.DB.Where("org_id = ? AND provider = 'jira'", dbUser.OrgID).First(&integration).Error; err != nil {
			fmt.Printf("❌ [VAULT FATAL] Could not find Jira keys in integrations table! Error: %v\n", err)
		} else {
			fmt.Println("✅ [VAULT SUCCESS] Retrieved Jira Integration Keys.")
		}
	} else if repo.PMProvider == "linear" {
		fmt.Println("⧓ [ADAPTER TRAP] Booting Linear Engine...")
	}

	return repo, mapping, orch, nil
}

func (s *VSCodeService) GetProjects(dbUser models.User) ([]string, error) {
	var repos []models.Repository
	var projectNames []string

	if dbUser.Role == "admin" {
		fmt.Printf("👑 [RBAC] Admin %s requested projects. Returning ALL repos.\n", dbUser.Email)
		database.DB.Select("repo_name").Where("org_id = ?", dbUser.OrgID).Find(&repos)
		for _, repo := range repos {
			projectNames = append(projectNames, repo.RepoName)
		}
	} else {
		fmt.Printf("👷 [RBAC] Developer %s requested projects. Filtering by assignments.\n", dbUser.Email)
		var assignments []models.ProjectAssignment
		database.DB.Preload("Repository").Where("user_id = ? AND org_id = ?", dbUser.ID, dbUser.OrgID).Find(&assignments)
		for _, assignment := range assignments {
			if assignment.Repository.RepoName != "" {
				projectNames = append(projectNames, assignment.Repository.RepoName)
			}
		}
	}
	return projectNames, nil
}

func (s *VSCodeService) GetTickets(repoName string, dbUser models.User) (bool, []models.Ticket, error) {
	fmt.Println("\n================================================")
	fmt.Printf("📥 [VS CODE INCOMING] Requesting tickets for: %s\n", repoName)

	repo, mapping, orch, err := s.getRepoAndOrchestrator(repoName, dbUser)
	if err != nil {
		return false, nil, err
	}

	if repo.PMProvider == "none" || repo.PMProvider == "" {
		fmt.Printf("⚠️ [ABORT] PM Provider is empty or 'none'.\n")
		return false, make([]models.Ticket, 0), nil
	}

	if repo.PMProvider == "jira" {
		fmt.Println("🚀 [API TRAP] Fetching REAL tickets from Jira API...")
		var integration models.Integration
		database.DB.Where("org_id = ? AND provider = 'jira'", dbUser.OrgID).First(&integration)
		var tickets []models.Ticket

		if integration.SecretID != nil {
			decryptedJSON, _ := vault.GetDecryptedSecret(*integration.SecretID)
			var creds map[string]string
			json.Unmarshal([]byte(decryptedJSON), &creds)
			jiraAPI := adapters.NewJiraAdapter(creds["baseUrl"], creds["email"], creds["apiToken"])
			tickets = jiraAPI.GetTickets(repo.PMProjectID)
		}

		if tickets == nil {
			tickets = make([]models.Ticket, 0)
		}

		fmt.Printf("✅ [JIRA SUCCESS] Returning %d tickets.\n", len(tickets))
		fmt.Println("================================================")
		return true, tickets, nil
	}

	if repo.PMProvider == "linear" {
		fmt.Println("🚀 [API TRAP] Fetching REAL tickets from Linear API...")
		var integration models.Integration
		database.DB.Where("org_id = ? AND provider = 'linear'", dbUser.OrgID).First(&integration)
		var tickets []models.Ticket

		if integration.SecretID != nil {
			decryptedJSON, _ := vault.GetDecryptedSecret(*integration.SecretID)
			token := decryptedJSON
			var creds map[string]string
			if json.Unmarshal([]byte(decryptedJSON), &creds) == nil {
				if creds["token"] != "" {
					token = creds["token"]
				}
				if creds["apiKey"] != "" {
					token = creds["apiKey"]
				}
			}

			linearAPI := adapters.NewLinearAdapter(token)
			teamKey := ""
			if val, ok := mapping["team_key"].(string); ok {
				teamKey = val
			}

			if teamKey != "" {
				tickets = linearAPI.GetTickets(teamKey)
			}
		}

		if tickets == nil {
			tickets = make([]models.Ticket, 0)
		}

		fmt.Printf("✅ [LINEAR SUCCESS] Returning %d tickets.\n", len(tickets))
		fmt.Println("================================================")
		return true, tickets, nil
	}

	fmt.Println("🚀 [API TRAP] Fetching tickets from Basecamp API...")
	tickets := orch.GetTickets(repo.PMProvider, repo.PMProjectID, dbUser.OrgID, mapping)
	if tickets == nil {
		tickets = make([]models.Ticket, 0)
	}

	fmt.Printf("✅ [API SUCCESS] Returning %d tickets.\n", len(tickets))
	fmt.Println("================================================")
	return true, tickets, nil
}

func (s *VSCodeService) SuggestTasks(codeDiff string) []string {
	aiAPI := adapters.NewAIAdapter()
	return aiAPI.GenerateTaskSuggestions(codeDiff)
}

func (s *VSCodeService) CreateTask(taskInput, repoName string, dbUser models.User) (string, error) {
	repo, mapping, orch, err := s.getRepoAndOrchestrator(repoName, dbUser)
	if err != nil || repo.PMProvider == "none" {
		return "", fmt.Errorf("No PM tool configured or assigned.")
	}

	var resolvedTaskID string

	if repo.PMProvider == "jira" {
		fmt.Printf("🏗️ [JIRA] Creating ticket for: %s\n", taskInput)
		var integration models.Integration
		database.DB.Where("org_id = ? AND provider = 'jira'", dbUser.OrgID).First(&integration)

		if integration.SecretID != nil {
			decryptedJSON, _ := vault.GetDecryptedSecret(*integration.SecretID)
			var creds map[string]string
			json.Unmarshal([]byte(decryptedJSON), &creds)
			jiraAPI := adapters.NewJiraAdapter(creds["baseUrl"], creds["email"], creds["apiToken"])

			newID, err := jiraAPI.CreateTicket(repo.PMProjectID, taskInput)
			if err == nil && newID != "" {
				resolvedTaskID = newID
			} else {
				re := regexp.MustCompile(`[^a-zA-Z0-9]`)
				resolvedTaskID = strings.ToLower(re.ReplaceAllString(taskInput, "-"))
			}
		}
	} else if repo.PMProvider == "linear" {
		fmt.Printf("🏗️ [LINEAR] Creating ticket for: %s\n", taskInput)
		var integration models.Integration
		database.DB.Where("org_id = ? AND provider = 'linear'", dbUser.OrgID).First(&integration)

		if integration.SecretID != nil {
			decryptedJSON, _ := vault.GetDecryptedSecret(*integration.SecretID)
			token := decryptedJSON
			var creds map[string]string
			if json.Unmarshal([]byte(decryptedJSON), &creds) == nil {
				if creds["token"] != "" {
					token = creds["token"]
				}
				if creds["apiKey"] != "" {
					token = creds["apiKey"]
				}
			}

			linearAPI := adapters.NewLinearAdapter(token)
			newID, err := linearAPI.CreateTicket(repo.PMProjectID, taskInput)
			if err == nil && newID != "" {
				resolvedTaskID = newID
			} else {
				re := regexp.MustCompile(`[^a-zA-Z0-9]`)
				resolvedTaskID = strings.ToLower(re.ReplaceAllString(taskInput, "-"))
			}
		}
	} else {
		resolvedTaskID, _ = orch.ResolveTask(repo.PMProvider, repo.PMProjectID, taskInput, dbUser.OrgID, mapping)
	}

	return resolvedTaskID, nil
}

func (s *VSCodeService) StartTask(taskInput, repoName, developer string, dbUser models.User) (string, error) {
	repo, mapping, orch, err := s.getRepoAndOrchestrator(repoName, dbUser)

	re := regexp.MustCompile(`[^a-zA-Z0-9]`)
	resolvedTaskID := strings.ToLower(re.ReplaceAllString(taskInput, "-"))

	if err == nil && repo.PMProvider != "none" {
		if repo.PMProvider == "jira" {
			ticketID := adapters.ExtractTicketID(taskInput)
			if ticketID != "" {
				resolvedTaskID = ticketID
				var integration models.Integration
				database.DB.Where("org_id = ? AND provider = 'jira'", dbUser.OrgID).First(&integration)

				if integration.SecretID != nil {
					decryptedJSON, _ := vault.GetDecryptedSecret(*integration.SecretID)
					var creds map[string]string
					json.Unmarshal([]byte(decryptedJSON), &creds)

					jiraAPI := adapters.NewJiraAdapter(creds["baseUrl"], creds["email"], creds["apiToken"])
					transitions, _ := jiraAPI.GetAvailableTransitions(ticketID)

					for _, t := range transitions {
						name, _ := t["name"].(string)
						if strings.Contains(strings.ToLower(name), "progress") || strings.Contains(strings.ToLower(name), "doing") {
							transitionID, _ := t["id"].(string)
							jiraAPI.TransitionIssue(ticketID, transitionID)
							break
						}
					}
				}
			} else {
				var integration models.Integration
				database.DB.Where("org_id = ? AND provider = 'jira'", dbUser.OrgID).First(&integration)

				if integration.SecretID != nil {
					decryptedJSON, _ := vault.GetDecryptedSecret(*integration.SecretID)
					var creds map[string]string
					json.Unmarshal([]byte(decryptedJSON), &creds)

					jiraAPI := adapters.NewJiraAdapter(creds["baseUrl"], creds["email"], creds["apiToken"])
					newID, err := jiraAPI.CreateTicket(repo.PMProjectID, taskInput)
					if err == nil && newID != "" {
						resolvedTaskID = newID
						transitions, _ := jiraAPI.GetAvailableTransitions(newID)
						for _, t := range transitions {
							name, _ := t["name"].(string)
							if strings.Contains(strings.ToLower(name), "progress") || strings.Contains(strings.ToLower(name), "doing") {
								transitionID, _ := t["id"].(string)
								jiraAPI.TransitionIssue(newID, transitionID)
								break
							}
						}
					}
				}
			}

		} else if repo.PMProvider == "linear" {
			ticketID := adapters.ExtractTicketID(taskInput)
			var integration models.Integration
			database.DB.Where("org_id = ? AND provider = 'linear'", dbUser.OrgID).First(&integration)

			if integration.SecretID != nil {
				decryptedJSON, _ := vault.GetDecryptedSecret(*integration.SecretID)
				token := decryptedJSON
				var creds map[string]string
				if json.Unmarshal([]byte(decryptedJSON), &creds) == nil {
					if creds["token"] != "" {
						token = creds["token"]
					}
					if creds["apiKey"] != "" {
						token = creds["apiKey"]
					}
				}

				linearAPI := adapters.NewLinearAdapter(token)

				if ticketID != "" {
					resolvedTaskID = ticketID
					parts := strings.Split(ticketID, "-")
					if len(parts) == 2 {
						states, _ := linearAPI.GetAvailableStates(parts[0])
						for _, s := range states {
							name, _ := s["name"].(string)
							if strings.Contains(strings.ToLower(name), "progress") || strings.Contains(strings.ToLower(name), "doing") {
								linearAPI.TransitionIssue(ticketID, s["id"].(string))
								break
							}
						}
					}
				} else {
					newID, err := linearAPI.CreateTicket(repo.PMProjectID, taskInput)
					if err == nil && newID != "" {
						resolvedTaskID = newID
						parts := strings.Split(newID, "-")
						if len(parts) == 2 {
							states, _ := linearAPI.GetAvailableStates(parts[0])
							for _, s := range states {
								name, _ := s["name"].(string)
								if strings.Contains(strings.ToLower(name), "progress") || strings.Contains(strings.ToLower(name), "doing") {
									linearAPI.TransitionIssue(newID, s["id"].(string))
									break
								}
							}
						}
					}
				}
			}

		} else {
			var exactCardUrl string
			resolvedTaskID, exactCardUrl = orch.ResolveTask(repo.PMProvider, repo.PMProjectID, taskInput, dbUser.OrgID, mapping)

			extractID := func(key string) string {
				if val, ok := mapping[key].(string); ok {
					return val
				} else if val, ok := mapping[key].(float64); ok {
					return fmt.Sprintf("%.0f", val)
				}
				return ""
			}

			inProgressID := extractID("branch_created")
			if inProgressID == "" {
				inProgressID = extractID("in_progress")
			}

			if inProgressID != "" && exactCardUrl != "" {
				orch.UpdateTicketStatus(repo.PMProvider, repo.PMProjectID, exactCardUrl, inProgressID, dbUser.OrgID)
			}
			if developer != "" && exactCardUrl != "" {
				orch.AssignTicket(repo.PMProvider, repo.PMProjectID, exactCardUrl, developer, dbUser.OrgID)
			}
		}

		queuePayload := map[string]interface{}{
			"eventType": "local_start",
			"payload": map[string]interface{}{
				"taskId":     resolvedTaskID,
				"repository": map[string]string{"full_name": repoName},
			},
		}
		queueJSON, _ := json.Marshal(queuePayload)
		redis.Client.LPush(context.Background(), "tron:v3_secret_queue", queueJSON)
	}

	return resolvedTaskID, nil
}

func (s *VSCodeService) FetchAIReview(taskID string) (string, error) {
	review, err := redis.Client.Get(context.Background(), "ai_review:"+taskID).Result()
	if err != nil || review == "" {
		return "", fmt.Errorf("No AI review found for this task yet.")
	}
	return review, nil
}

func (s *VSCodeService) FetchDiscordChannels(botToken string) ([]map[string]interface{}, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	req, _ := http.NewRequest("GET", "https://discord.com/api/v10/users/@me/guilds", nil)
	req.Header.Set("Authorization", "Bot "+botToken)
	guildsRes, err := client.Do(req)

	if err != nil || guildsRes.StatusCode >= 400 {
		return nil, fmt.Errorf("Invalid token or Discord API error.")
	}
	defer guildsRes.Body.Close()

	var guilds []map[string]interface{}
	json.NewDecoder(guildsRes.Body).Decode(&guilds)

	if len(guilds) == 0 {
		return nil, fmt.Errorf("Bot is not in any Discord servers yet!")
	}

	guildID := fmt.Sprintf("%v", guilds[0]["id"])

	req, _ = http.NewRequest("GET", fmt.Sprintf("https://discord.com/api/v10/guilds/%s/channels", guildID), nil)
	req.Header.Set("Authorization", "Bot "+botToken)
	channelsRes, err := client.Do(req)
	if err != nil || channelsRes.StatusCode >= 400 {
		return nil, fmt.Errorf("Invalid token or Discord API error.")
	}
	defer channelsRes.Body.Close()

	var allChannels []map[string]interface{}
	json.NewDecoder(channelsRes.Body).Decode(&allChannels)

	var textChannels []map[string]interface{}
	for _, ch := range allChannels {
		if fmt.Sprintf("%v", ch["type"]) == "0" {
			textChannels = append(textChannels, map[string]interface{}{
				"id":   ch["id"],
				"name": ch["name"],
			})
		}
	}

	return textChannels, nil
}
