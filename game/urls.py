from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('game/', views.game_view, name='game'),
    path('save-settings/', views.save_settings, name='save_settings'),
]