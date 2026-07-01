package response

import "github.com/gin-gonic/gin"

func Success(c *gin.Context, data interface{}) {
	c.JSON(200, data)
}

type ErrorResponse struct {
	Message string `json:"message"`
}

func Error(c *gin.Context, status int, message string) {
	c.JSON(status, ErrorResponse{Message: message})
}

type PageResponse struct {
	Content       interface{} `json:"content"`
	TotalElements int64       `json:"totalElements"`
	TotalPages    int         `json:"totalPages"`
	Size          int         `json:"size"`
	Number        int         `json:"number"`
	First         bool        `json:"first"`
	Last          bool        `json:"last"`
	Empty         bool        `json:"empty"`
}

func Page(c *gin.Context, content interface{}, totalElements int64, size, number int) {
	if size <= 0 {
		size = 10
	}
	if number < 0 {
		number = 0
	}

	totalPages := int((totalElements + int64(size) - 1) / int64(size))
	first := number == 0
	last := number >= totalPages-1
	if totalPages == 0 {
		last = true
	}

	c.JSON(200, PageResponse{
		Content:       content,
		TotalElements: totalElements,
		TotalPages:    totalPages,
		Size:          size,
		Number:        number,
		First:         first,
		Last:          last,
		Empty:         totalElements == 0,
	})
}
