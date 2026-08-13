variable "aws_region" {
  type    = string
  default = "af-south-1"
}
variable "project_name" {
  type    = string
  default = "jnit-customs-document-tracking"
}
variable "environment" {
  type    = string
  default = "poc"
}
variable "allowed_origin" {
  type    = string
  default = "*"
}
variable "log_retention_days" {
  type    = number
  default = 7
}
