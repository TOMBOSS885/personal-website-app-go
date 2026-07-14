package mailer

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"mime"
	"net"
	"net/smtp"
	"personal-website-go/internal/config"
	"strconv"
	"strings"
	"time"
)

func Configured() bool {
	cfg := config.AppConfig
	return cfg != nil && cfg.SMTPHost != "" && cfg.SMTPFrom != ""
}

func SendLoginCode(ctx context.Context, to, code string, expires time.Duration) error {
	if !Configured() {
		return errors.New("SMTP is not configured")
	}
	cfg := config.AppConfig
	if strings.ContainsAny(to+cfg.SMTPFrom+cfg.SMTPFromName, "\r\n") {
		return errors.New("invalid email header")
	}
	minutes := int(expires.Round(time.Minute) / time.Minute)
	if minutes < 1 {
		minutes = 10
	}
	subject := mime.QEncoding.Encode("UTF-8", "您的邮箱验证码")
	body := fmt.Sprintf("您的验证码是：%s\r\n\r\n验证码将在 %d 分钟后失效，请勿转发给他人。\r\n如果不是您本人操作，请忽略此邮件。", code, minutes)
	message := []byte("From: " + formatAddress(cfg.SMTPFromName, cfg.SMTPFrom) + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"Content-Transfer-Encoding: 8bit\r\n\r\n" + body + "\r\n")

	port := cfg.SMTPPort
	if port <= 0 {
		port = 587
	}
	address := net.JoinHostPort(cfg.SMTPHost, strconv.Itoa(port))
	dialer := &net.Dialer{Timeout: 8 * time.Second}
	var conn net.Conn
	var client *smtp.Client
	var err error

	if cfg.SMTPTLSMode == "tls" {
		conn, err = tls.DialWithDialer(dialer, "tcp", address, tlsConfig(cfg.SMTPHost))
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", address)
	}
	if err != nil {
		return err
	}
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}
	client, err = smtp.NewClient(conn, cfg.SMTPHost)
	if err != nil {
		_ = conn.Close()
		return err
	}
	defer client.Close()

	if cfg.SMTPTLSMode == "tls" {
		// The connection is already encrypted.
	} else if cfg.SMTPTLSMode == "starttls" {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return errors.New("SMTP server does not support STARTTLS")
		}
		if err := client.StartTLS(tlsConfig(cfg.SMTPHost)); err != nil {
			return err
		}
	}
	if cfg.SMTPUsername != "" {
		if cfg.SMTPTLSMode == "none" {
			return errors.New("refusing to send SMTP credentials without TLS")
		}
		if err := client.Auth(smtp.PlainAuth("", cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPHost)); err != nil {
			return err
		}
	}
	if err := client.Mail(cfg.SMTPFrom); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(message); err != nil {
		_ = w.Close()
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	// A successful DATA close means the server accepted the message. A later
	// QUIT failure must not invalidate a code that may already be delivered.
	_ = client.Quit()
	return nil
}

func tlsConfig(host string) *tls.Config {
	return &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
}

func formatAddress(name, address string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return address
	}
	return fmt.Sprintf("%s <%s>", mime.QEncoding.Encode("UTF-8", name), address)
}
