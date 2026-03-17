package middleware

import (
	"net/http"

	"github.com/kr4t0n/orbit/backend/internal/models"
	"github.com/gin-gonic/gin"
)

// AdminRequired checks that the authenticated user has is_admin = true
func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		userVal, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required",
				"code":  "unauthenticated",
			})
			c.Abort()
			return
		}

		user, ok := userVal.(*models.User)
		if !ok || !user.IsAdmin {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Admin privileges required",
				"code":  "forbidden",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
